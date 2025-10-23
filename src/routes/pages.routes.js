import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';

const router = Router();

// Show topics list
router.get('/forum', (req, res) => {
  res.render('topics-list', { user: req.user });
});

// Show new topic form
router.get('/forum/new', requireAuth, (req, res) => {
  res.render('forum-new', { user: req.user });
});

// Show topic detail
router.get('/forum/:id', (req, res) => {
  res.render('forum-detail', { 
    user: req.user, 
    topicId: req.params.id 
  });
});

export default router;