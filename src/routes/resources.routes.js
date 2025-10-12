import { Router } from 'express';
import { requireAuth} from '../middleware/auth.js';

const router = Router();

router.post('/', requireAuth, async (req, res) => {
  res.json({ ok: true, message: 'Resources upload stub' });
});

export default router;
