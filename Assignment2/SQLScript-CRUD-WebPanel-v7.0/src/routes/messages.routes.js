import { Router } from 'express';
import auth from '../middleware/auth.js';
const router = Router();

router.get('/threads', auth(true), async (req, res) => {
  res.json({ todo: 'list message threads' });
});

export default router;
