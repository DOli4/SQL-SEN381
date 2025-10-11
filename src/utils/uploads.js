import multer from 'multer';
import path from 'node:path';
import fs from 'node:fs';
import { v4 as uuid } from 'uuid';
import mime from 'mime-types';

const ROOT = path.resolve(process.cwd(), 'uploads');

// Ensure root exists
fs.mkdirSync(ROOT, { recursive: true });

// Decide per-entity subfolder (topic or reply)
function resolveDestination(req) {
  const { topicId, replyId } = req.body;
  const sub = topicId ? path.join('topics', String(topicId))
            : replyId ? path.join('replies', String(replyId))
            : 'misc';
  const dest = path.join(ROOT, sub);
  fs.mkdirSync(dest, { recursive: true });
  return dest;
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, resolveDestination(req)),
  filename: (req, file, cb) => {
    const ext = mime.extension(file.mimetype) ? '.' + mime.extension(file.mimetype) : path.extname(file.originalname);
    cb(null, uuid() + ext.toLowerCase());
  }
});

// ~50MB limit, tweak as needed
export const upload = multer({
  storage,
  limits: { fileSize: 50 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    // Example gate: allow common docs/images/videos; tighten if needed
    const ok = /^(application|image|video|audio|text)\//.test(file.mimetype);
    cb(ok ? null : new Error('Unsupported file type'), ok);
  }
});
