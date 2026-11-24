import express from 'express';
import inventoryController from '../controllers/inventory.controller.js';
import { requireAdmin } from '../middleware/auth.middleware.js';

const router = express.Router();

// Public or Customer stock queries
router.get('/', (req, res) => inventoryController.getAllStock(req, res));
router.post('/check', (req, res) => inventoryController.checkAvailability(req, res));
router.get('/low-stock', requireAdmin, (req, res) => inventoryController.getLowStock(req, res));
router.get('/:productId', (req, res) => inventoryController.getProductStock(req, res));

// Admin stock adjustment
router.put('/stock/:productId', requireAdmin, (req, res) => inventoryController.updateStock(req, res));
router.delete('/:productId', requireAdmin, (req, res) => inventoryController.deleteStock(req, res));
router.post('/replenish', requireAdmin, (req, res) => inventoryController.replenishStock(req, res));

// Order workflow deduction
router.post('/deduct', (req, res) => inventoryController.deductStock(req, res));

export default router;
