import { Router } from 'express';
import multer from 'multer';
import { requireAuth } from '../middleware/auth.js';
import { getPool, sql } from '../db/mssql.js';

const router = Router();

// Set up multer for handling file uploads
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 } // 10MB limit
});

// LIST topics (for /forum page)
router.get('/', requireAuth, async (req, res) => {
  const pool = await getPool();
  const r = await pool.request().query(`
    SELECT 
      t.Topic_ID, t.Title, t.Module_ID, t.User_ID, t.Description, t.Created_At,
      COUNT(DISTINCT r.Reply_ID) as ReplyCount,
      COUNT(DISTINCT c.Content_ID) as FileCount
    FROM dbo.Topic t
    LEFT JOIN dbo.Reply r ON r.Topic_ID = t.Topic_ID
    LEFT JOIN dbo.Content c ON c.Topic_ID = t.Topic_ID
    GROUP BY t.Topic_ID, t.Title, t.Module_ID, t.User_ID, t.Description, t.Created_At
    ORDER BY t.Created_At DESC
    OFFSET 0 ROWS FETCH NEXT 50 ROWS ONLY
  `);
  res.json(r.recordset);
});

// PUT /api/topics/:id/withfiles - Update topic and manage files
router.put('/:id/withfiles', requireAuth, upload.array('files', 10), async (req, res) => {
  console.log('Starting topic update:', req.params.id);
  
  const topicId = Number(req.params.id);
  if (isNaN(topicId)) {
    console.error('Invalid topic ID:', req.params.id);
    return res.status(400).json({ error: 'Invalid topic ID' });
  }

  let transaction;
  try {
    const pool = await getPool();
    transaction = new sql.Transaction(pool);
    await transaction.begin();
    console.log('Transaction started');

    // 1. Get current topic and verify ownership
    console.log('Checking ownership with user ID:', req.user?.sub);
    const topicCheck = await transaction.request()
      .input('id', sql.Int, topicId)
      .input('userId', sql.Int, req.user?.sub)
      .query(`
        SELECT User_ID FROM dbo.Topic 
        WHERE Topic_ID = @id AND User_ID = @userId
      `);

    console.log('Topic check result:', topicCheck.recordset);
    
    if (topicCheck.recordset.length === 0) {
      console.error('Topic not found or unauthorized - ID:', topicId, 'User:', req.user?.sub);
      await transaction.rollback();
      return res.status(403).json({ error: 'Topic not found or unauthorized' });
    }

    console.log('Topic ownership verified');

    // 2. Update topic basic info
    // 2. Update topic basic info
    await transaction.request()
      .input('id', sql.Int, topicId)
      .input('title', sql.NVarChar, req.body.title || '')
      .input('moduleId', sql.Int, req.body.moduleId || 0)
      .input('description', sql.NVarChar, req.body.description || '')
      .query(`
        UPDATE dbo.Topic 
        SET Title = @title, Module_ID = @moduleId, Description = @description
        WHERE Topic_ID = @id
      `);
    console.log('Topic info updated');

    // 3. Handle kept files vs deleted files
    let keepFiles = [];
    try {
      keepFiles = JSON.parse(req.body.keepFiles || '[]');
      console.log('Kept files:', keepFiles);
    } catch (e) {
      console.error('Error parsing keepFiles:', e);
      keepFiles = [];
    }
    
    // Delete files that are not in keepFiles
    if (keepFiles.length > 0) {
      await transaction.request()
        .input('topicId', sql.Int, topicId)
        .query(`
          DELETE FROM dbo.Content 
          WHERE Topic_ID = @topicId 
            AND Content_ID NOT IN (${keepFiles.join(',')})
        `);
    } else {
      // If no files are kept, delete all files
      await transaction.request()
        .input('topicId', sql.Int, topicId)
        .query(`
          DELETE FROM dbo.Content 
          WHERE Topic_ID = @topicId
        `);
    }
    console.log('Existing files handled');

    // 4. Add new files
    if (req.files && req.files.length > 0) {
      console.log('Processing new files:', req.files.length);
      for (const file of req.files) {
        await transaction.request()
          .input('topicId', sql.Int, topicId)
          .input('fileName', sql.NVarChar, file.originalname)
          .input('contentType', sql.NVarChar, file.mimetype)
          .input('fileData', sql.VarBinary, file.buffer)
          .input('fileSize', sql.Int, file.size)
          .query(`
            INSERT INTO dbo.Content (Topic_ID, FileName, ContentType, FileData, FileSize)
            VALUES (@topicId, @fileName, @contentType, @fileData, @fileSize)
          `);
      }
      console.log('New files processed');
    }

    await transaction.commit();
    console.log('Transaction committed successfully');
    res.json({ success: true, message: 'Topic updated successfully' });
  } catch (error) {
    console.error('Update topic error:', error);
    if (transaction) {
      try {
        await transaction.rollback();
        console.log('Transaction rolled back');
      } catch (rollbackError) {
        console.error('Rollback failed:', rollbackError);
      }
    }
    res.status(500).json({ 
      error: error.message || 'Failed to update topic' 
    });
  }
});

// GET /api/topics/:id - get single topic with files and replies
router.get('/:id', requireAuth, async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (isNaN(id)) {
      return res.status(400).json({ error: 'Invalid topic ID' });
    }

    const pool = await getPool();

    // Get topic
    const topicResult = await pool.request()
      .input('id', sql.Int, id)
      .query(`
        SELECT Topic_ID, Title, Module_ID, User_ID, Description, Created_At
        FROM dbo.Topic 
        WHERE Topic_ID = @id
      `);

    if (!topicResult.recordset || !topicResult.recordset[0]) {
      return res.status(404).json({ error: 'Topic not found' });
    }

    const topic = topicResult.recordset[0];

    // Get files
    const filesResult = await pool.request()
      .input('id', sql.Int, id)
      .query(`
        SELECT Content_ID, FileName, FileSize as SizeBytes, ContentType as MimeType, Created_At
        FROM dbo.Content
        WHERE Topic_ID = @id
        ORDER BY Created_At DESC
      `);

    // Get replies
    const repliesResult = await pool.request()
      .input('id', sql.Int, id)
      .query(`
        SELECT Reply_ID, Description as Content, User_ID, Created_At
        FROM dbo.Reply
        WHERE Topic_ID = @id
        ORDER BY Created_At DESC
      `);

    res.json({
      topic,
      files: filesResult.recordset || [],
      replies: repliesResult.recordset || []
    });
  } catch (err) {
    console.error('Get topic error:', err);
    res.status(500).json({ error: err.message });
  }
});

// CREATE topic  <-- THIS is what your /forum/new page calls
router.post('/', requireAuth, async (req, res) => {
  const { title, moduleId, description } = req.body;
  if (!title || !moduleId) return res.status(400).json({ error: 'title and moduleId are required' });

  const pool = await getPool();
  const q = await pool.request()
    .input('User_ID', sql.Int, req.user.sub)        // set by requireAuth
    .input('Module_ID', sql.Int, Number(moduleId))
    .input('Title', sql.VarChar(500), title.trim())
    .input('Description', sql.VarChar(sql.MAX), (description || '').trim() || null)
    .query(`
      INSERT INTO dbo.Topic (User_ID, Module_ID, Title, [Description])
      OUTPUT INSERTED.Topic_ID
      VALUES (@User_ID, @Module_ID, @Title, @Description)
    `);

  res.status(201).json({ Topic_ID: q.recordset[0].Topic_ID });
});

// CREATE topic with files
router.post('/withfiles', requireAuth, upload.array('files', 10), async (req, res) => {
  try {
    console.log('Request body:', req.body);
    console.log('Files received:', req.files?.length || 0);
    if (req.files) {
      console.log('File details:', req.files.map(f => ({
        name: f.originalname,
        size: f.size,
        mimetype: f.mimetype
      })));
    }
    
    const { title, moduleId, description } = req.body;
    const files = req.files || [];

    if (!title || !moduleId) {
      return res.status(400).json({ error: 'title and moduleId are required' });
    }

    const pool = await getPool();
    
    // First create the topic
    const topicResult = await pool.request()
      .input('User_ID', sql.Int, req.user.sub)
      .input('Module_ID', sql.Int, Number(moduleId))
      .input('Title', sql.VarChar(500), title.trim())
      .input('Description', sql.VarChar(sql.MAX), (description || '').trim() || null)
      .query(`
        INSERT INTO dbo.Topic (User_ID, Module_ID, Title, [Description])
        OUTPUT INSERTED.Topic_ID
        VALUES (@User_ID, @Module_ID, @Title, @Description)
      `);

    const topicId = topicResult.recordset[0].Topic_ID;

    // Then add any files
    if (files.length > 0) {
      for (const file of files) {
        await pool.request()
          .input('Topic_ID', sql.Int, topicId)
          .input('FileName', sql.VarChar(255), file.originalname)
          .input('FileData', sql.VarBinary(sql.MAX), file.buffer)
          .input('FileSize', sql.Int, file.size)
          .input('ContentType', sql.VarChar(100), file.mimetype)
          .query(`
            INSERT INTO dbo.Content (Topic_ID, FileName, FileData, FileSize, ContentType)
            VALUES (@Topic_ID, @FileName, @FileData, @FileSize, @ContentType)
          `);
      }
    }

    res.status(201).json({ Topic_ID: topicId });
  } catch (error) {
    console.error('Create topic with files error:', error);
    res.status(500).json({ error: 'Failed to create topic: ' + error.message });
  }
});

// helper: is this user allowed to change/delete the topic?
async function ensureOwnerOrAdmin(pool, topicId, user) {
  const r = await pool.request().input('id', sql.Int, topicId)
    .query('SELECT User_ID FROM dbo.Topic WHERE Topic_ID=@id');
  if (!r.recordset.length) return { ok:false, status:404, msg:'Topic not found' };

  const ownerId = r.recordset[0].User_ID;
  const isOwner = ownerId === user.sub;
  const role = (user.RoleName || user.role || '').toLowerCase();
  const isAdmin = role === 'admin';

  return isOwner || isAdmin ? { ok:true } : { ok:false, status:403, msg:'Forbidden' };
}

// PUT /api/topics/:id  (edit)
router.put('/:id', requireAuth, upload.array('files', 10), async (req, res) => {
  const id = Number(req.params.id);
  const { title, moduleId, description } = req.body;
  if (!title || !moduleId) return res.status(400).json({ error:'title and moduleId are required' });

  const pool = await getPool();
  const authz = await ensureOwnerOrAdmin(pool, id, req.user);
  if (!authz.ok) return res.status(authz.status).json({ error: authz.msg });

  let transaction;
  try {
    transaction = new sql.Transaction(pool);
    await transaction.begin();

    // Update topic info
    await transaction.request()
      .input('id', sql.Int, id)
      .input('Title', sql.VarChar(500), title.trim())
      .input('Module_ID', sql.Int, Number(moduleId))
      .input('Description', sql.VarChar(sql.MAX), (description || '').trim() || null)
      .query(`
        UPDATE dbo.Topic
        SET Title=@Title, Module_ID=@Module_ID, [Description]=@Description
        WHERE Topic_ID=@id
      `);

    // Handle file uploads if any
    if (req.files && req.files.length > 0) {
      for (const file of req.files) {
        await transaction.request()
          .input('Topic_ID', sql.Int, id)
          .input('FileName', sql.VarChar(255), file.originalname)
          .input('FileData', sql.VarBinary(sql.MAX), file.buffer)
          .input('FileSize', sql.Int, file.size)
          .input('ContentType', sql.VarChar(100), file.mimetype)
          .query(`
            INSERT INTO dbo.Content (Topic_ID, FileName, FileData, FileSize, ContentType)
            VALUES (@Topic_ID, @FileName, @FileData, @FileSize, @ContentType)
          `);
      }
    }

    await transaction.commit();
    res.json({ ok: true });
  } catch (error) {
    if (transaction) {
      try {
        await transaction.rollback();
      } catch (rollbackError) {
        console.error('Rollback failed:', rollbackError);
      }
    }
    res.status(500).json({ error: error.message || 'Failed to update topic' });
  }
});

// DELETE /api/topics/:id - soft delete topic
router.delete('/:id', requireAuth, async (req, res) => {
  try {
    const id = Number(req.params.id);
    const pool = await getPool();
    const authz = await ensureOwnerOrAdmin(pool, id, req.user);
    if (!authz.ok) return res.status(authz.status).json({ error: authz.msg });

    // Hard delete associated content first
    await pool.request()
      .input('id', sql.Int, id)
      .query(`
        DELETE FROM dbo.Content 
        WHERE Topic_ID = @id
      `);

    // Hard delete associated replies
    await pool.request()
      .input('id', sql.Int, id)
      .query(`
        DELETE FROM dbo.Reply 
        WHERE Topic_ID = @id
      `);

    // Hard delete the topic
    await pool.request()
      .input('id', sql.Int, id)
      .query(`
        DELETE FROM dbo.Topic 
        WHERE Topic_ID = @id
      `);

    res.json({ ok: true });
  } catch (err) {
    console.error('Delete topic error:', err);
    res.status(500).json({ error: err.message });
  }
});

// POST /api/topics/:id/replies - add reply to topic
router.post('/:id/replies', requireAuth, async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (isNaN(id)) {
      return res.status(400).json({ error: 'Invalid topic ID' });
    }

    const { text } = req.body;
    if (!text || text.trim().length < 2) {
      return res.status(400).json({ error: 'Reply text must be at least 2 characters' });
    }

    const pool = await getPool();

    // Verify topic exists
    const topicCheck = await pool.request()
      .input('id', sql.Int, id)
      .query(`
        SELECT Topic_ID 
        FROM dbo.Topic 
        WHERE Topic_ID = @id
      `);

    if (!topicCheck.recordset?.[0]) {
      return res.status(404).json({ error: 'Topic not found' });
    }

    // Add reply
    await pool.request()
      .input('topicId', sql.Int, id)
      .input('userId', sql.Int, req.user.sub)
      .input('text', sql.VarChar(sql.MAX), text.trim())
      .query(`
        INSERT INTO dbo.Reply (Topic_ID, User_ID, Description)
        VALUES (@topicId, @userId, @text)
      `);

    res.status(201).json({ ok: true });
  } catch (err) {
    console.error('Add reply error:', err);
    res.status(500).json({ error: err.message });
  }
});


export default router;
