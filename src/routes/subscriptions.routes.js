// src/routes/subscriptions.routes.js
import { Router } from 'express'
import { requireAuth } from '../middleware/auth.js'
import { getUserSubscriptions, getTopicSubscribers } from '../controllers/subscriptions.controller.js'

const router = Router()

// User’s own subscriptions (or admin/tutor can view any)
router.get('/users/:userId/subscriptions', requireAuth, getUserSubscriptions)

// Optional admin/tutor endpoint
router.get('/topics/:topicId/subscribers', requireAuth, getTopicSubscribers)

export default router
