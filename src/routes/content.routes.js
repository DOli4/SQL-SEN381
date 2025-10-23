import { Router } from 'express';
import multer from 'multer';
import { getPool, sql } from '../db/mssql.js';
import { requireAuth } from '../middleware/auth.js';
import fs from 'node:fs';
import path from 'node:path';

const router = Router();

fs.mkdirSync('uploads', { recursive: true });

const upload = multer({
  dest: 'uploads/',
  limits: { fileSize: 5 * 1024 * 1024 }, // 5 MB
  fileFilter: (req, file, cb) => {
    const allowed = [
      'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/vnd.ms-powerpoint',
      'application/vnd.openxmlformats-officedocument.presentationml.presentation',
      'image/png',
      'image/jpeg'
    ];
    if (!allowed.includes(file.mimetype)) return cb(new Error('Unsupported file type'));
    cb(null, true);
  }
});

// DELETE /api/content/:id
router.delete('/:id', requireAuth, async (req, res) => {
  const contentId = Number(req.params.id);
  if (isNaN(contentId)) {
    return res.status(400).json({ error: 'Invalid content ID' });
  }

  const pool = await getPool();
  
  try {
    // Check ownership through topic
    const check = await pool.request()
      .input('contentId', sql.Int, contentId)
      .input('userId', sql.Int, req.user.id)
      .query(`
        SELECT c.Content_ID 
        FROM dbo.Content c
        JOIN dbo.Topic t ON t.Topic_ID = c.Topic_ID
        WHERE c.Content_ID = @contentId 
          AND t.User_ID = @userId
          AND (c.IsDeleted = 0 OR c.IsDeleted IS NULL)
      `);

    if (check.recordset.length === 0) {
      return res.status(404).json({ error: 'Content not found or unauthorized' });
    }

    // Soft delete the content
    await pool.request()
      .input('contentId', sql.Int, contentId)
      .query(`
        UPDATE dbo.Content
        SET IsDeleted = 1
        WHERE Content_ID = @contentId
      `);

    res.json({ success: true });
  } catch (error) {
    console.error('Delete content error:', error);
    res.status(500).json({ error: error.message || 'Failed to delete content' });
  }
});

// POST /api/topics/:id/content  (upload)
router.post(
  '/topics/:id/content',
  requireAuth,
  (req, res, next) => upload.single('file')(req, res, (err) => {
    if (err) {
      console.error('Multer error:', err);
      return res.status(400).json({ error: err.message });
    }
    next();
  }),
  async (req, res) => {
    try {
      const topicId = Number(req.params.id);
      if (!req.file) return res.status(400).json({ error: 'No file uploaded' });

      const pool = await getPool();
      await pool.request()
        .input('Topic_ID', sql.Int, topicId)
        .input('User_ID', sql.Int, req.user.sub)
        .input('FileName', sql.VarChar(255), req.file.originalname)
        .input('FilePath', sql.VarChar(500), req.file.path.replaceAll('\\', '/'))
        .input('MimeType', sql.VarChar(100), req.file.mimetype)
        .input('SizeBytes', sql.Int, req.file.size)
        .query(`
          INSERT INTO dbo.Content (Topic_ID, User_ID, FileName, FilePath, MimeType, SizeBytes)
          VALUES (@Topic_ID, @User_ID, @FileName, @FilePath, @MimeType, @SizeBytes)
        `);

      console.log('Uploaded', req.file.originalname);
      res.json({ ok: true, file: req.file });
    } catch (err) {
      console.error('Upload failed:', err);
      res.status(500).json({ error: err.message });
    }
  }
);


// GET /api/topics/:id/content  (list)
router.get('/topics/:id/content', requireAuth, async (req, res) => {
  const topicId = Number(req.params.id);
  const pool = await getPool();
  const r = await pool.request()
    .input('Topic_ID', sql.Int, topicId)
    .query(`
      SELECT Content_ID, Topic_ID, User_ID, FileName, FilePath, MimeType, SizeBytes
      FROM dbo.Content
      WHERE Topic_ID = @Topic_ID
      ORDER BY Content_ID DESC
    `);
  res.json(r.recordset);
});

// GET /api/content/:contentId/inline  (open in browser)
router.get('/content/:contentId/inline', requireAuth, async (req, res) => {
  const id = Number(req.params.contentId);
  const pool = await getPool();
  const r = await pool.request()
    .input('Content_ID', sql.Int, id)
    .query(`SELECT FileName, FilePath, MimeType FROM dbo.Content WHERE Content_ID = @Content_ID`);
  if (!r.recordset.length) return res.status(404).send('Not found');

  const row = r.recordset[0];
  res.setHeader('Content-Type', row.MimeType || 'application/octet-stream');
  res.setHeader('Content-Disposition', `inline; filename="${encodeURIComponent(row.FileName)}"`);
  res.sendFile(path.resolve(row.FilePath));
});

// GET /api/content/:contentId/download  (force download)
router.get('/content/:contentId/download', requireAuth, async (req, res) => {
  const id = Number(req.params.contentId);
  const pool = await getPool();
  const r = await pool.request()
    .input('Content_ID', sql.Int, id)
    .query(`SELECT FileName, FilePath FROM dbo.Content WHERE Content_ID = @Content_ID`);
  if (!r.recordset.length) return res.status(404).send('Not found');

  const row = r.recordset[0];
  res.download(path.resolve(row.FilePath), row.FileName);
});

export default router;
