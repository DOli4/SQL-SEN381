import { Router } from 'express';
import { register, login } from '../controllers/auth.controller.js';

const router = Router();
router.get('/health', (_req, res) => res.json({ ok: true }));
router.post('/register', register);
router.post('/login', login);

export default router;
