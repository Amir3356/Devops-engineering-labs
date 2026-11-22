import express from 'express';
import paymentController from '../controllers/payment.controller.js';
import { requireAuth, requireAdmin } from '../middleware/auth.middleware.js';

const router = express.Router();

// Process payment (Customer or Gateway checkout)
router.post('/process', requireAuth, (req, res) => paymentController.processPayment(req, res));

// Admin sales report & analytics
router.get('/sales-report', requireAdmin, (req, res) => paymentController.getSalesReport(req, res));

// Admin view all payment records
router.get('/records', requireAdmin, (req, res) => paymentController.getAllRecords(req, res));

// Customer get own payment history
router.get('/', requireAuth, (req, res) => paymentController.getMyPayments(req, res));

// Get payment by ID
router.get('/:id', requireAuth, (req, res) => paymentController.getPaymentById(req, res));

export default router;
