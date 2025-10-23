import { Router } from 'express';
import { requireAuth, requireRole } from '../middleware/auth.js';

const router = Router();

router.get('/', requireAuth, requireRole('Admin'), async (req, res) => {
  res.json({ ok: true, message: 'Tutors endpoint stub' });
});

export default router;
