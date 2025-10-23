// src/controllers/content.controller.js
import path from 'node:path';
import fs from 'node:fs';
import { getPool, sql } from '../db/mssql.js';

/**
 * Files must live under <repo>/data/studydocs
 */
const STUDYDOCS_ROOT = path.resolve(process.cwd(), 'data', 'studydocs');
fs.mkdirSync(STUDYDOCS_ROOT, { recursive: true });

/**
 * Strip any leading "..", normalize, and ensure the absolute path
 * is strictly inside STUDYDOCS_ROOT (prevents path traversal).
 */
function resolveUnderStudydocs(relOrAbsPath) {
  const abs = path.isAbsolute(relOrAbsPath)
    ? path.normalize(relOrAbsPath)
    : path.resolve(process.cwd(), relOrAbsPath);

  const root = STUDYDOCS_ROOT + path.sep; // ensure trailing sep for strict prefix
  const normalized = path.normalize(abs) + (abs.endsWith(path.sep) ? '' : '');

  if (!(normalized === STUDYDOCS_ROOT || normalized.startsWith(root))) {
    throw new Error('Invalid file path');
  }
  return normalized;
}

/**
 * Turn an absolute path inside the repo into a forward-slash relative path
 * we store in the DB (portable across OS).
 */
function toRepoRelative(absPath) {
  return path.relative(process.cwd(), absPath).replace(/\\/g, '/');
}

/**
 * Insert a row for an uploaded file.
 * Expects: req.file (multer), req.body.topicId or req.body.replyId
 * Returns: { Content_ID }
 */
export async function uploadContent(req, res) {
  try {
    if (!req.user) return res.status(401).json({ error: 'Unauthorized' });

    const file = req.file; // use upload.single('file')
    if (!file) return res.status(400).json({ error: 'No file uploaded' });

    const { topicId, replyId } = req.body;
    if (!topicId && !replyId) {
      return res.status(400).json({ error: 'Provide topicId or replyId' });
    }

    // Ensure multer saved the file under data/studydocs
    const absSaved = resolveUnderStudydocs(file.path);
    const relPath = toRepoRelative(absSaved);

    const pool = await getPool();
    const q = await pool.request()
      .input('Reply_ID',     sql.Int,     replyId ? Number(replyId) : null)
      .input('Topic_ID',     sql.Int,     topicId ? Number(topicId) : null)
      .input('Path',         sql.VarChar(300), relPath)
      .input('OriginalName', sql.VarChar(255), file.originalname)
      .input('MimeType',     sql.VarChar(100), file.mimetype)
      .input('SizeBytes',    sql.BigInt,  file.size)
      .input('UploadedBy',   sql.Int,     req.user.sub)
      .query(`
        INSERT INTO dbo.Content
          (Reply_ID, Topic_ID, [Path], OriginalName, MimeType, SizeBytes, UploadedBy)
        OUTPUT INSERTED.Content_ID
        VALUES
          (@Reply_ID, @Topic_ID, @Path, @OriginalName, @MimeType, @SizeBytes, @UploadedBy)
      `);

    res.status(201).json({ Content_ID: q.recordset[0].Content_ID });
  } catch (e) {
    console.error('UPLOAD ERROR:', e);
    res.status(500).json({ error: e.message || 'Upload failed' });
  }
}

/**
 * GET one content row metadata
 */
export async function getMeta(req, res) {
  try {
    const id = Number(req.params.id);
    const pool = await getPool();
    const r = await pool.request()
      .input('id', sql.Int, id)
      .query(`
        SELECT Content_ID, Reply_ID, Topic_ID, [Path], OriginalName, MimeType, SizeBytes, UploadedBy, UploadedAt
        FROM dbo.Content
        WHERE Content_ID = @id
      `);
    if (!r.recordset.length) return res.status(404).json({ error: 'Not found' });
    res.json(r.recordset[0]);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
}

/** Internal helper: load row and resolve absolute path safely */
async function getRowAndPath(id) {
  const pool = await getPool();
  const r = await pool.request()
    .input('id', sql.Int, id)
    .query(`SELECT Content_ID, OriginalName, MimeType, [Path] FROM dbo.Content WHERE Content_ID = @id`);
  if (!r.recordset.length) return null;

  const row = r.recordset[0];
  const abs = resolveUnderStudydocs(path.resolve(process.cwd(), row.Path));
  return { row, abs };
}

/**
 * GET /content/:id/download
 * Force download with original filename
 */
export async function download(req, res) {
  try {
    const id = Number(req.params.id);
    const out = await getRowAndPath(id);
    if (!out) return res.status(404).send('Not found');

    const { row, abs } = out;
    if (!fs.existsSync(abs)) return res.status(410).send('File missing');

    res.setHeader('Content-Type', row.MimeType || 'application/octet-stream');
    res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(row.OriginalName)}"`);
    fs.createReadStream(abs).pipe(res);
  } catch (e) {
    console.error('DOWNLOAD ERROR:', e);
    res.status(500).send('Download failed');
  }
}

/**
 * GET /content/:id/view
 * Inline render (PDF/images)
 */
export async function viewInline(req, res) {
  try {
    const id = Number(req.params.id);
    const out = await getRowAndPath(id);
    if (!out) return res.status(404).send('Not found');

    const { row, abs } = out;
    if (!fs.existsSync(abs)) return res.status(410).send('File missing');

    res.setHeader('Content-Type', row.MimeType || 'application/octet-stream');
    res.setHeader('Content-Disposition', `inline; filename="${encodeURIComponent(row.OriginalName)}"`);
    fs.createReadStream(abs).pipe(res);
  } catch (e) {
    console.error('INLINE ERROR:', e);
    res.status(500).send('View failed');
  }
}

/**
 * DELETE /content/:id
 * Removes DB row and file on disk
 */
export async function remove(req, res) {
  try {
    const id = Number(req.params.id);
    const pool = await getPool();

    // Get path first
    const r = await pool.request()
      .input('id', sql.Int, id)
      .query(`SELECT [Path] FROM dbo.Content WHERE Content_ID = @id`);
    if (!r.recordset.length) return res.status(404).json({ error: 'Not found' });

    const rel = r.recordset[0].Path;
    const abs = resolveUnderStudydocs(path.resolve(process.cwd(), rel));

    // Delete row
    await pool.request().input('id', sql.Int, id).query('DELETE FROM dbo.Content WHERE Content_ID = @id');

    // Best-effort delete file
    try { if (fs.existsSync(abs)) fs.unlinkSync(abs); } catch { /* ignore */ }

    res.status(204).end();
  } catch (e) {
    console.error('DELETE ERROR:', e);
    res.status(500).json({ error: e.message });
  }
}
