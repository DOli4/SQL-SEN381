import { Router } from 'express';
import { requireAuth} from '../middleware/auth.js';

const router = Router();

router.get('/threads', requireAuth, async (req, res) => {
  res.json({ ok: true, message: 'Message threads stub' });
});

export default router;
