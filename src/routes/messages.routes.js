import { Router } from 'express';
import auth from '../middleware/auth.js';

const router = Router();

router.get('/threads', auth(true), async (req, res) => {
  res.json({ ok: true, message: 'Message threads stub' });
});

export default router;
