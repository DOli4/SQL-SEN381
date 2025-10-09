import { Router } from 'express';
import auth from '../middleware/auth.js';
const router = Router();

router.post('/', auth(true), async (req, res) => {
  res.json({ todo: 'upload resource' });
});

export default router;
