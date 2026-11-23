import express from 'express';
import saleController from '../controllers/sale.controller.js';
import { requireAuth, requireAdmin } from '../middleware/auth.middleware.js';

const router = express.Router();

router.get('/', (req, res) => saleController.getSales(req, res));
router.get('/:id', (req, res) => saleController.getSaleById(req, res));
router.post('/', requireAuth, requireAdmin, (req, res) => saleController.createSale(req, res));
router.delete('/:id', requireAuth, requireAdmin, (req, res) => saleController.deleteSale(req, res));

export default router;
