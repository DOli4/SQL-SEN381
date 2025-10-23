import { Router } from 'express';
import { getPool } from '../db/mssql.js';
import multer from 'multer';

const r = Router();
const upload = multer({ 
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 } // 10MB limit
});

// Guards
function requireLogin(req, res, next){
  if(!req.user) return res.status(401).json({ error: 'Login required' });
  next();
}

function canModify(userId, userRole, topicUserId){
  const role = (userRole || '').toLowerCase();
  return topicUserId === userId || role === 'admin';
}

// --------- Pages ----------
r.get('/forum', (req, res) => {
  res.render('forum', { user: req.user });
});

r.get('/forum/new', requireLogin, (req, res) => {
  res.render('forum-new', { user: req.user });
});

r.get('/forum/:id', (req, res) => {
  res.render('forum-detail', { user: req.user, topicId: req.params.id });
});

// Debug endpoint
r.post('/api/topics/test', requireLogin, upload.array('files', 10), async (req, res) => {
  res.json({
    body: req.body,
    files: req.files?.map(f => ({ name: f.originalname, size: f.size })) || []
  });
});

// --------- API: list topics ----------
r.get('/api/topics', async (req, res) => {
  try {
    const pool = await getPool();
    const { recordset } = await pool.request().query(`
      SELECT 
        t.Topic_ID, t.Title, t.Description, t.Module_ID, t.User_ID, t.Created_At,
        COUNT(DISTINCT r.Reply_ID) as ReplyCount,
        COUNT(DISTINCT c.Content_ID) as FileCount
      FROM dbo.Topics t
      LEFT JOIN dbo.Replies r ON r.Topic_ID = t.Topic_ID
      LEFT JOIN dbo.Content c ON c.Topic_ID = t.Topic_ID
      WHERE t.IsDeleted = 0 OR t.IsDeleted IS NULL
      GROUP BY t.Topic_ID, t.Title, t.Description, t.Module_ID, t.User_ID, t.Created_At
      ORDER BY t.Created_At DESC
    `);
    res.json(recordset || []);
  } catch (e) {
    console.error('List topics error:', e);
    res.status(500).json({ error: e.message });
  }
});

// --------- API: get single topic with files and replies ----------
r.get('/api/topics/:id', async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (isNaN(id)) {
      return res.status(400).json({ error: 'Invalid topic ID' });
    }

    const pool = await getPool();
    
    // Get topic
    const topicResult = await pool.request()
      .input('id', id)
      .query(`
        SELECT Topic_ID, Title, Description, Module_ID, User_ID, Created_At
        FROM dbo.Topics 
        WHERE Topic_ID = @id AND (IsDeleted = 0 OR IsDeleted IS NULL)
      `);
    
    if (!topicResult.recordset || !topicResult.recordset[0]) {
      return res.status(404).json({ error: 'Topic not found' });
    }

    const topic = topicResult.recordset[0];

    // Get files
    let files = [];
    try {
      const filesResult = await pool.request()
        .input('id', id)
        .query(`
          SELECT Content_ID, FileName, OriginalName, MimeType, SizeBytes, Created_At
          FROM dbo.Content
          WHERE Topic_ID = @id
          ORDER BY Created_At ASC
        `);
      files = filesResult.recordset || [];
    } catch (e) {
      console.error('Error loading files:', e);
    }

    // Get replies
    let replies = [];
    try {
      const repliesResult = await pool.request()
        .input('id', id)
        .query(`
          SELECT Reply_ID, Description, User_ID, Created_At
          FROM dbo.Replies
          WHERE Topic_ID = @id
          ORDER BY Created_At ASC
        `);
      replies = repliesResult.recordset || [];
    } catch (e) {
      console.error('Error loading replies:', e);
    }

    res.json({
      topic: topic,
      files: files,
      replies: replies
    });
  } catch (e) {
    console.error('Get topic error:', e);
    res.status(500).json({ error: 'Failed to load topic: ' + e.message });
  }
});

// --------- API: create topic (JSON version - working) ----------
r.post('/api/topics', requireLogin, async (req, res) => {
  try {
    console.log('=== CREATE TOPIC REQUEST ===');
    console.log('Content-Type:', req.headers['content-type']);
    console.log('Request body:', req.body);
    console.log('Body keys:', Object.keys(req.body));
    
    const title = req.body.title || req.body.Title;
    const moduleId = req.body.moduleId || req.body.Module_ID || req.body.module;
    const description = req.body.description || req.body.Description || req.body.content;
    
    console.log('Extracted values:', { title, moduleId, description });
    
    if (!title || title.trim().length < 1) {
      console.error('❌ Title validation failed');
      return res.status(400).json({ 
        error: 'Title is required',
        received: req.body
      });
    }
    
    if (!moduleId) {
      console.error('❌ ModuleId validation failed');
      return res.status(400).json({ 
        error: 'Module ID is required',
        received: req.body
      });
    }

    const pool = await getPool();
    const userId = req.user?.sub || req.user?.id || req.user?.User_ID;

    console.log('Inserting into database...');
    const result = await pool.request()
      .input('title', title.trim())
      .input('desc', description?.trim() || null)
      .input('moduleId', Number(moduleId))
      .input('userId', userId)
      .query(`
        INSERT INTO dbo.Topics (Title, Description, Module_ID, User_ID, IsDeleted)
        VALUES (@title, @desc, @moduleId, @userId, 0);
        SELECT SCOPE_IDENTITY() AS Topic_ID;
      `);

    const topicId = result.recordset[0].Topic_ID;
    console.log('✅ Topic created successfully! ID:', topicId);
    
    res.json({ ok: true, Topic_ID: topicId });
  } catch (e) {
    console.error('=== CREATE TOPIC ERROR ===');
    console.error(e);
    res.status(500).json({ error: 'Failed to create topic: ' + e.message });
  }
});

// --------- API: create topic with files (for later) ----------
r.post('/api/topics/withfiles', requireLogin, upload.array('files', 10), async (req, res) => {
  try {
    console.log('Full request body:', req.body);
    console.log('Files received:', req.files?.length || 0);
    
    // Extract all possible field name variations
    const title = req.body.title || req.body.Title;
    const moduleId = req.body.moduleId || req.body.Module_ID || req.body.module;
    const description = req.body.description || req.body.Description || req.body.content;
    
    console.log('Extracted values:', { title, moduleId, description });
    
    if (!title || title.trim().length < 1) {
      console.error('Title validation failed:', title);
      return res.status(400).json({ error: 'Title is required' });
    }
    
    if (!moduleId) {
      console.error('ModuleId validation failed:', moduleId);
      return res.status(400).json({ error: 'Module ID is required' });
    }

    const pool = await getPool();
    const userId = req.user?.sub || req.user?.id || req.user?.User_ID;

    // Insert topic
    const result = await pool.request()
      .input('title', title.trim())
      .input('desc', description?.trim() || null)
      .input('moduleId', Number(moduleId))
      .input('userId', userId)
      .query(`
        INSERT INTO dbo.Topics (Title, Description, Module_ID, User_ID, IsDeleted)
        VALUES (@title, @desc, @moduleId, @userId, 0);
        SELECT SCOPE_IDENTITY() AS Topic_ID;
      `);

    const topicId = result.recordset[0].Topic_ID;

    // Insert files if any
    if (req.files && req.files.length > 0) {
      for (const file of req.files) {
        try {
          await pool.request()
            .input('topicId', topicId)
            .input('fileName', file.originalname)
            .input('mimeType', file.mimetype)
            .input('size', file.size)
            .input('data', file.buffer)
            .query(`
              INSERT INTO dbo.Content (Topic_ID, FileName, OriginalName, MimeType, SizeBytes, FileData)
              VALUES (@topicId, @fileName, @fileName, @mimeType, @size, @data)
            `);
        } catch (e) {
          console.error('Error uploading file:', file.originalname, e);
        }
      }
    }

    res.json({ ok: true, Topic_ID: topicId });
  } catch (e) {
    console.error('Create topic error:', e);
    res.status(500).json({ error: 'Failed to create topic: ' + e.message });
  }
});

// --------- API: update topic ----------
r.put('/api/topics/:id', requireLogin, async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (isNaN(id)) {
      return res.status(400).json({ error: 'Invalid topic ID' });
    }

    const { title, moduleId, description } = req.body;
    const pool = await getPool();

    // Check permissions
    const topicResult = await pool.request()
      .input('id', id)
      .query('SELECT User_ID FROM dbo.Topics WHERE Topic_ID = @id AND (IsDeleted = 0 OR IsDeleted IS NULL)');
    
    if (!topicResult.recordset || !topicResult.recordset[0]) {
      return res.status(404).json({ error: 'Topic not found' });
    }

    const userId = req.user?.sub || req.user?.id || req.user?.User_ID;
    const userRole = req.user?.role || req.user?.RoleName;
    
    if (!canModify(userId, userRole, topicResult.recordset[0].User_ID)) {
      return res.status(403).json({ error: 'Permission denied' });
    }

    await pool.request()
      .input('id', id)
      .input('title', title.trim())
      .input('desc', description?.trim() || null)
      .input('moduleId', Number(moduleId))
      .query(`
        UPDATE dbo.Topics 
        SET Title = @title, Description = @desc, Module_ID = @moduleId
        WHERE Topic_ID = @id
      `);

    res.json({ ok: true });
  } catch (e) {
    console.error('Update topic error:', e);
    res.status(500).json({ error: 'Failed to update topic: ' + e.message });
  }
});

// --------- API: delete topic ----------
r.delete('/api/topics/:id', requireLogin, async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (isNaN(id)) {
      return res.status(400).json({ error: 'Invalid topic ID' });
    }

    const pool = await getPool();

    // Check permissions
    const topicResult = await pool.request()
      .input('id', id)
      .query('SELECT User_ID FROM dbo.Topics WHERE Topic_ID = @id AND (IsDeleted = 0 OR IsDeleted IS NULL)');
    
    if (!topicResult.recordset || !topicResult.recordset[0]) {
      return res.status(404).json({ error: 'Topic not found' });
    }

    const userId = req.user?.sub || req.user?.id || req.user?.User_ID;
    const userRole = req.user?.role || req.user?.RoleName;
    
    if (!canModify(userId, userRole, topicResult.recordset[0].User_ID)) {
      return res.status(403).json({ error: 'Permission denied' });
    }

    await pool.request()
      .input('id', id)
      .query('UPDATE dbo.Topics SET IsDeleted = 1 WHERE Topic_ID = @id');

    res.json({ ok: true });
  } catch (e) {
    console.error('Delete topic error:', e);
    res.status(500).json({ error: 'Failed to delete topic: ' + e.message });
  }
});

// --------- API: add reply ----------
r.post('/api/topics/:id/replies', requireLogin, async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (isNaN(id)) {
      return res.status(400).json({ error: 'Invalid topic ID' });
    }

    const { description } = req.body;

    if (!description || description.trim().length < 2) {
      return res.status(400).json({ error: 'Reply must be at least 2 characters' });
    }

    const pool = await getPool();
    const userId = req.user?.sub || req.user?.id || req.user?.User_ID;

    // Check topic exists
    const topicResult = await pool.request()
      .input('id', id)
      .query('SELECT Topic_ID FROM dbo.Topics WHERE Topic_ID = @id AND (IsDeleted = 0 OR IsDeleted IS NULL)');
    
    if (!topicResult.recordset || !topicResult.recordset[0]) {
      return res.status(404).json({ error: 'Topic not found' });
    }

    await pool.request()
      .input('topicId', id)
      .input('desc', description.trim())
      .input('userId', userId)
      .query(`
        INSERT INTO dbo.Replies (Topic_ID, Description, User_ID)
        VALUES (@topicId, @desc, @userId)
      `);

    res.json({ ok: true });
  } catch (e) {
    console.error('Reply error:', e);
    res.status(500).json({ error: 'Failed to post reply: ' + e.message });
  }
});

// --------- API: download content ----------
r.get('/api/content/:id/download', async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (isNaN(id)) {
      return res.status(400).send('Invalid file ID');
    }

    const pool = await getPool();
    
    const result = await pool.request()
      .input('id', id)
      .query('SELECT FileName, MimeType, FileData FROM dbo.Content WHERE Content_ID = @id');
    
    if (!result.recordset || !result.recordset[0]) {
      return res.status(404).send('File not found');
    }

    const { FileName, MimeType, FileData } = result.recordset[0];
    res.setHeader('Content-Disposition', `attachment; filename="${FileName}"`);
    res.setHeader('Content-Type', MimeType || 'application/octet-stream');
    res.send(FileData);
  } catch (e) {
    console.error('Download error:', e);
    res.status(500).send('Download failed');
  }
});

r.get('/api/content/:id/inline', async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (isNaN(id)) {
      return res.status(400).send('Invalid file ID');
    }

    const pool = await getPool();
    
    const result = await pool.request()
      .input('id', id)
      .query('SELECT FileName, MimeType, FileData FROM dbo.Content WHERE Content_ID = @id');
    
    if (!result.recordset || !result.recordset[0]) {
      return res.status(404).send('File not found');
    }

    const { FileName, MimeType, FileData } = result.recordset[0];
    res.setHeader('Content-Disposition', `inline; filename="${FileName}"`);
    res.setHeader('Content-Type', MimeType || 'application/octet-stream');
    res.send(FileData);
  } catch (e) {
    console.error('View error:', e);
    res.status(500).send('View failed');
  }
});

export default r;