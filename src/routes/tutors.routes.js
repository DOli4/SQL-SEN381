import { Router } from 'express';
import auth from '../middleware/auth.js';
import allowRoles from '../middleware/rbac.js';

const router = Router();

router.get('/', auth(true), allowRoles('Admin'), async (req, res) => {
  res.json({ ok: true, message: 'Tutors endpoint stub' });
});

export default router;
