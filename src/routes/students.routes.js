import { Router } from 'express';
import auth from '../middleware/auth.js';
import allowRoles from '../middleware/rbac.js';

const router = Router();

// Example Admin-only endpoint
router.get('/', auth(true), allowRoles('Admin'), async (req, res) => {
  res.json({ ok: true, message: 'Students endpoint stub' });
});

export default router;
