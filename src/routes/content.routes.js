import { Router } from 'express';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { upload } from '../utils/uploads.js';
import { uploadContent, getMeta, download, viewInline, remove } from '../controllers/content.controller.js';

const router = Router();

router.post('/', requireAuth, upload.single('file'), uploadContent);
router.get('/:id', requireAuth, getMeta);
router.get('/:id/download', requireAuth, download);
router.get('/:id/inline', requireAuth, viewInline);
router.delete('/:id', requireAuth, requireRole('Admin'), remove);

export default router;
