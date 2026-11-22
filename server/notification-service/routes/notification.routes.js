import express from 'express';
import notificationController from '../controllers/notification.controller.js';
import { requireAuth, requireAdmin } from '../middleware/auth.middleware.js';

const router = express.Router();

// Customer gets own notifications
router.get('/', requireAuth, (req, res) => notificationController.getMyNotifications(req, res));

// Administrator gets all notifications
router.get('/all', requireAdmin, (req, res) => notificationController.getAllNotifications(req, res));

// Send a notification
router.post('/', requireAuth, (req, res) => notificationController.createNotification(req, res));

// Mark a notification as read
router.patch('/:id/read', requireAuth, (req, res) => notificationController.markAsRead(req, res));

export default router;
