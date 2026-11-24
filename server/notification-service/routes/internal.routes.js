import express from 'express';
import { sendSaleReceipt, sendOrderReceipt } from '../services/email.service.js';
import { success, error } from '../../utils/response.js';

/**
 * Internal endpoints for other services (not exposed through the API gateway,
 * which only forwards /api/notifications/*).
 */
const router = express.Router();
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

router.post('/email/sale-receipt', async (req, res) => {
  const body = req.body || {};
  if (!EMAIL.test(String(body.to || ''))) {
    return error(res, 'A valid recipient email (to) is required', 400);
  }
  if (!body.productName || !body.saleId) {
    return error(res, 'saleId and productName are required', 400);
  }
  try {
    const result = await sendSaleReceipt(body);
    return success(res, result, 'Receipt email sent');
  } catch (err) {
    console.error('[Notification Service] Receipt email failed:', err.message);
    return error(res, err.message, err.status || 502);
  }
});

router.post('/email/order-receipt', async (req, res) => {
  const body = req.body || {};
  if (!EMAIL.test(String(body.to || ''))) {
    return error(res, 'A valid recipient email (to) is required', 400);
  }
  if (!body.orderId || !Array.isArray(body.items) || body.items.length === 0) {
    return error(res, 'orderId and items are required', 400);
  }
  try {
    const result = await sendOrderReceipt(body);
    return success(res, result, 'Order receipt email sent');
  } catch (err) {
    console.error('[Notification Service] Order receipt email failed:', err.message);
    return error(res, err.message, err.status || 502);
  }
});

export default router;
