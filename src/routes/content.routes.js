// src/routes/content.routes.js  (DB-FREE, local-only + debug form)
import { Router } from 'express';
import multer from 'multer';
import fs from 'node:fs';
import path from 'node:path';
import { requireAuth } from '../middleware/auth.js';

const router = Router();

/* ── Local storage under data/studydocs ─────────────────────────────── */
const DEST = path.resolve(process.cwd(), 'data', 'studydocs');
const MANIFEST = path.join(DEST, 'index.json');
fs.mkdirSync(DEST, { recursive: true });

function readManifest() {
  try { return JSON.parse(fs.readFileSync(MANIFEST, 'utf8')); }
  catch { return []; }
}
function writeManifest(list) {
  fs.writeFileSync(MANIFEST, JSON.stringify(list, null, 2));
}
function resolveUnderRoot(p) {
  const abs = path.resolve(p);
  const root = DEST + path.sep;
  if (!(abs === DEST || abs.startsWith(root))) throw new Error('Invalid file path');
  return abs;
}
function slug(s) {
  return (s || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '').slice(0, 60) || 'file';
}

/* ── Multer config ──────────────────────────────────────────────────── */
const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, DEST),
  filename: (req, file, cb) => {
    const base = slug(req.body.title || file.originalname);
    const ts   = new Date().toISOString().replace(/[:.TZ]/g, '');
    const ext  = path.extname(file.originalname).toLowerCase();
    cb(null, `${base}-${ts}${ext}`);
  }
});

const allowed = new Set([
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-powerpoint',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'text/plain', 'text/markdown',
  'image/png', 'image/jpeg', 'image/gif', 'image/webp'
]);

const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
  fileFilter: (_req, file, cb) => cb(allowed.has(file.mimetype) ? null : new Error('Unsupported file type'))
});

/* ── DEBUG FORM: Quick standalone upload test ───────────────────────── */
const __storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, DEST),
  filename: (_req, file, cb) => cb(null, Date.now() + '-' + file.originalname)
});
const __upload = multer({ storage: __storage });

router.get('/_debug_form', (_req, res) => {
  res.send(`
    <!doctype html><meta charset="utf-8">
    <h3>Debug Upload Form</h3>
    <form action="/content/_debug_upload" method="post" enctype="multipart/form-data">
      <p><input type="file" name="file" required></p>
      <p><input name="title" placeholder="title"></p>
      <button type="submit">Upload</button>
    </form>
  `);
});

router.post('/_debug_upload', __upload.single('file'), (req, res) => {
  console.log('DEBUG /_debug_upload → ct:', req.headers['content-type']);
  console.log('DEBUG /_debug_upload → file?', !!req.file, 'name:', req.file?.originalname);
  console.log('DEBUG /_debug_upload → body keys:', Object.keys(req.body || {}));
  if (!req.file) return res.status(400).json({ error: 'No file uploaded (debug)' });
  return res.json({
    ok: true,
    savedAs: req.file.filename,
    size: req.file.size,
    body: req.body
  });
});

/* ── Page: Upload form (no DB) ──────────────────────────────────────── */
router.get('/upload', requireAuth, (req, res) => {
  res.render('content-upload', { user: req.user, ok: req.query.ok, modules: [] });
});

/* ── POST: Upload (local only) ──────────────────────────────────────── */
router.post(
  '/upload',
  requireAuth,
  (req, res, next) => {
    upload.any()(req, res, err => {
      if (err) return res.status(400).json({ error: err.message });
      if (!req.file && Array.isArray(req.files) && req.files.length > 0) req.file = req.files[0];
      next();
    });
  },
  async (req, res) => {
    console.log('UPLOAD DEBUG',
      'ct=', req.headers['content-type'],
      'has file=', !!req.file,
      'files[] len=', Array.isArray(req.files) ? req.files.length : 'n/a',
      'body keys=', Object.keys(req.body || {}));

    try {
      if (!req.file) return res.status(400).json({ error: 'No file uploaded' });

      const file = req.file;
      const meta = {
        id: Date.now().toString(),
        title: req.body.title || file.originalname,
        moduleId: req.body.moduleId || null,
        notes: req.body.notes || '',
        userId: req.user?.sub ?? null,
        fileName: file.originalname,
        savedName: path.basename(file.path),
        filePath: file.path.replace(/\\/g, '/'),
        mimeType: file.mimetype,
        sizeBytes: file.size,
        uploadedAt: new Date().toISOString()
      };

      const list = readManifest();
      list.push(meta);
      writeManifest(list);

      return res.redirect('/content/upload?ok=1');
    } catch (err) {
      console.error('Upload failed:', err);
      return res.status(500).json({ error: err.message || 'Upload failed' });
    }
  }
);

/* ── API: List all uploaded files ───────────────────────────────────── */
router.get('/local', requireAuth, (_req, res) => {
  res.json(readManifest().sort((a, b) => Number(b.id) - Number(a.id)));
});

/* ── API: Inline view / Download by local id ────────────────────────── */
router.get('/local/:id/inline', requireAuth, (req, res) => {
  const row = readManifest().find(x => x.id === req.params.id);
  if (!row) return res.status(404).send('Not found');
  const abs = resolveUnderRoot(path.resolve(DEST, row.savedName));
  res.setHeader('Content-Type', row.mimeType || 'application/octet-stream');
  res.setHeader('Content-Disposition', `inline; filename="${encodeURIComponent(row.fileName)}"`);
  res.sendFile(abs);
});

router.get('/local/:id/download', requireAuth, (req, res) => {
  const row = readManifest().find(x => x.id === req.params.id);
  if (!row) return res.status(404).send('Not found');
  const abs = resolveUnderRoot(path.resolve(DEST, row.savedName));
  res.download(abs, row.fileName);
});

/* ── API: Delete local file + manifest entry ────────────────────────── */
router.delete('/local/:id', requireAuth, (req, res) => {
  const list = readManifest();
  const idx = list.findIndex(x => x.id === req.params.id);
  if (idx === -1) return res.status(404).json({ error: 'Not found' });

  const row = list[idx];
  const abs = resolveUnderRoot(path.resolve(DEST, row.savedName));
  try { if (fs.existsSync(abs)) fs.unlinkSync(abs); } catch {}
  list.splice(idx, 1);
  writeManifest(list);

  res.status(204).end();
});

export default router;
