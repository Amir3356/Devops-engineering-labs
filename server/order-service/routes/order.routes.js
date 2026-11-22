import express from 'express';
import orderController from '../controllers/order.controller.js';
import { requireAuth, requireAdmin } from '../middleware/auth.middleware.js';
import { requireAbility } from '../../utils/ability.js';
import { validateBody, createOrderSchema } from '../../utils/validation.js';

const router = express.Router();

// Place order (Customer) with CASL ability & Zod validation
router.post('/', requireAuth, requireAbility('create', 'Order'), validateBody(createOrderSchema), (req, res) => orderController.placeOrder(req, res));

// Customer gets own orders
router.get('/', requireAuth, requireAbility('read', 'Order'), (req, res) => orderController.getMyOrders(req, res));

// Administrator gets all orders in system
router.get('/all', requireAdmin, requireAbility('manage', 'Order'), (req, res) => orderController.getAllOrders(req, res));

// Get single order
router.get('/:id', requireAuth, requireAbility('read', 'Order'), (req, res) => orderController.getOrderById(req, res));

// Update order status (Admin)
router.patch('/:id/status', requireAdmin, requireAbility('manage', 'Order'), (req, res) => orderController.updateStatus(req, res));

// Cancel order (Customer or Admin)
router.post('/:id/cancel', requireAuth, requireAbility('cancel', 'Order'), (req, res) => orderController.cancelOrder(req, res));

export default router;
