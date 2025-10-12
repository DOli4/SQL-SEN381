import { Router } from 'express';
import { requireAuth, requireRole } from '../middleware/auth.js';   // use these only

const router = Router();

// Example Admin-only endpoint
router.get('/', requireAuth, requireRole('Admin'), async (req, res) => {
  res.json({ ok: true, message: 'Students endpoint stub' });
});

export default router;
