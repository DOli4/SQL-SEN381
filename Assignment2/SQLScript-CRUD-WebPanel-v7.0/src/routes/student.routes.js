import { Router } from 'express';
import auth from '../middleware/auth.js';
import allowRoles from '../middleware/rbac.js';
const router = Router();

router.get('/', auth(true), allowRoles('Admin'), async (req, res) => {
  res.json({ todo: 'list students (Admin only)' });
});

export default router;
