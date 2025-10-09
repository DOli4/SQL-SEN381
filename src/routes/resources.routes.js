import { Router } from 'express';
import auth from '../middleware/auth.js';

const router = Router();

router.post('/', auth(true), async (req, res) => {
  res.json({ ok: true, message: 'Resources upload stub' });
});

export default router;
