import { Router } from 'express';
import { upload } from '../utils/uploads.js';
import { requireAuth } from '../middleware/auth.js';   // you already set this up for JWT cookie
import { uploadContent, getMeta, download, viewInline, remove } from '../controllers/content.controller.js';

const r = Router();

// Upload (multipart/form-data) with fields: topicId or replyId, plus "file"
r.post('/', requireAuth, upload.single('file'), uploadContent);

// Metadata
r.get('/:id', requireAuth, getMeta);

// Download / view
r.get('/:id/download', requireAuth, download);
r.get('/:id/inline',   requireAuth, viewInline);

// Delete
r.delete('/:id', requireAuth, remove);

export default r;
