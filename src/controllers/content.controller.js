import path from 'node:path';
import fs from 'node:fs';
import { getPool, sql } from '../db/mssql.js';

// Insert a row for an uploaded file
export async function uploadContent(req, res) {
  try {
    if (!req.user) return res.status(401).json({ error: 'Unauthorized' });
    const file = req.file;
    if (!file) return res.status(400).json({ error: 'No file uploaded' });

    const { topicId, replyId } = req.body;
    if (!topicId && !replyId) return res.status(400).json({ error: 'Provide topicId or replyId' });

    const relPath = path.relative(process.cwd(), file.path).replace(/\\/g, '/'); // store a forward-slash path

    const pool = await getPool();
    const q = await pool.request()
      .input('Reply_ID', sql.Int, replyId ? Number(replyId) : null)
      .input('Topic_ID', sql.Int, topicId ? Number(topicId) : null)
      .input('Path', sql.VarChar(300), relPath)
      .input('OriginalName', sql.VarChar(255), file.originalname)
      .input('MimeType', sql.VarChar(100), file.mimetype)
      .input('SizeBytes', sql.BigInt, file.size)
      .input('UploadedBy', sql.Int, req.user.sub)
      .query(`
        INSERT INTO dbo.Content (Reply_ID, Topic_ID, [Path], OriginalName, MimeType, SizeBytes, UploadedBy)
        OUTPUT INSERTED.Content_ID
        VALUES (@Reply_ID, @Topic_ID, @Path, @OriginalName, @MimeType, @SizeBytes, @UploadedBy)
      `);

    res.status(201).json({ Content_ID: q.recordset[0].Content_ID });
  } catch (e) {
    console.error('UPLOAD ERROR:', e);
    res.status(500).json({ error: e.message || 'Upload failed' });
  }
}

export async function getMeta(req, res) {
  try {
    const id = Number(req.params.id);
    const pool = await getPool();
    const r = await pool.request()
      .input('id', sql.Int, id)
      .query(`SELECT Content_ID, Reply_ID, Topic_ID, [Path], OriginalName, MimeType, SizeBytes, UploadedBy, UploadedAt
              FROM dbo.Content WHERE Content_ID = @id`);
    if (!r.recordset.length) return res.status(404).json({ error: 'Not found' });
    res.json(r.recordset[0]);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
}

function resolveFileAbs(relPath) {
  const abs = path.resolve(process.cwd(), relPath);
  // Guard: ensure path is inside uploads root
  const uploadsRoot = path.resolve(process.cwd(), 'uploads');
  if (!abs.startsWith(uploadsRoot)) throw new Error('Invalid file path');
  return abs;
}

export async function download(req, res) {
  try {
    const id = Number(req.params.id);
    const pool = await getPool();
    const r = await pool.request()
      .input('id', sql.Int, id)
      .query(`SELECT OriginalName, MimeType, [Path] FROM dbo.Content WHERE Content_ID = @id`);
    if (!r.recordset.length) return res.status(404).send('Not found');

    const { OriginalName, MimeType, Path: rel } = r.recordset[0];
    const abs = resolveFileAbs(rel);
    if (!fs.existsSync(abs)) return res.status(410).send('File missing');

    res.setHeader('Content-Type', MimeType || 'application/octet-stream');
    res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(OriginalName)}"`);
    fs.createReadStream(abs).pipe(res);
  } catch (e) {
    console.error('DOWNLOAD ERROR:', e);
    res.status(500).send('Download failed');
  }
}

export async function viewInline(req, res) {
  try {
    const id = Number(req.params.id);
    const pool = await getPool();
    const r = await pool.request()
      .input('id', sql.Int, id)
      .query(`SELECT OriginalName, MimeType, [Path] FROM dbo.Content WHERE Content_ID = @id`);
    if (!r.recordset.length) return res.status(404).send('Not found');

    const { OriginalName, MimeType, Path: rel } = r.recordset[0];
    const abs = resolveFileAbs(rel);
    if (!fs.existsSync(abs)) return res.status(410).send('File missing');

    res.setHeader('Content-Type', MimeType || 'application/octet-stream');
    res.setHeader('Content-Disposition', `inline; filename="${encodeURIComponent(OriginalName)}"`);
    fs.createReadStream(abs).pipe(res);
  } catch (e) {
    console.error('INLINE ERROR:', e);
    res.status(500).send('View failed');
  }
}

export async function remove(req, res) {
  try {
    const id = Number(req.params.id);
    const pool = await getPool();
    const r = await pool.request()
      .input('id', sql.Int, id)
      .query(`SELECT [Path] FROM dbo.Content WHERE Content_ID = @id`);
    if (!r.recordset.length) return res.status(404).json({ error: 'Not found' });

    const rel = r.recordset[0].Path;
    const abs = resolveFileAbs(rel);

    await pool.request().input('id', sql.Int, id).query('DELETE FROM dbo.Content WHERE Content_ID = @id');

    if (fs.existsSync(abs)) fs.unlinkSync(abs);
    res.status(204).end();
  } catch (e) {
    console.error('DELETE ERROR:', e);
    res.status(500).json({ error: e.message });
  }
}
