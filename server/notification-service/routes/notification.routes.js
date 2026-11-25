import express from 'express';
import notificationController from '../controllers/notification.controller.js';
import { requireAuth, requireAdmin } from '../middleware/auth.middleware.js';
import { emailQueueStats, retryFailedEmails } from '../queues/email.queue.js';
import { success, error } from '../../utils/response.js';

const router = express.Router();

// Customer gets own notifications
router.get('/', requireAuth, (req, res) => notificationController.getMyNotifications(req, res));

// Administrator gets all notifications
router.get('/all', requireAdmin, (req, res) => notificationController.getAllNotifications(req, res));

// Email queue health (Redis / BullMQ): waiting, active, delayed, completed, failed
router.get('/queue/emails', requireAdmin, async (req, res) => {
  try {
    return success(res, await emailQueueStats(), 'Email queue stats');
  } catch (err) {
    return error(res, `Email queue unavailable: ${err.message}`, 503);
  }
});

// Re-queue failed emails (e.g. after fixing SMTP settings)
router.post('/queue/emails/retry-failed', requireAdmin, async (req, res) => {
  try {
    const count = await retryFailedEmails();
    return success(res, { retried: count }, `Re-queued ${count} failed email(s)`);
  } catch (err) {
    return error(res, `Email queue unavailable: ${err.message}`, 503);
  }
});

// Send a notification
router.post('/', requireAuth, (req, res) => notificationController.createNotification(req, res));

// Mark a notification as read
router.patch('/:id/read', requireAuth, (req, res) => notificationController.markAsRead(req, res));

export default router;
