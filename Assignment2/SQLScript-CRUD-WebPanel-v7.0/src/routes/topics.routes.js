import { Router } from 'express';
import auth from '../middleware/auth.js';
import allowRoles from '../middleware/rbac.js';
import { list, getOne, create } from '../controllers/topics.controller.js';

const router = Router();
router.get('/', list);
router.get('/:id', getOne);
router.post('/', auth(true), allowRoles('Student'), create);

export default router;
