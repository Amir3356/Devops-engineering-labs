import express from 'express';
import purchaseController from '../controllers/purchase.controller.js';
import { requireAuth, requireAdmin } from '../middleware/auth.middleware.js';

const router = express.Router();

router.get('/', (req, res) => purchaseController.getPurchases(req, res));
router.get('/:id', (req, res) => purchaseController.getPurchaseById(req, res));
router.post('/', requireAuth, requireAdmin, (req, res) => purchaseController.createPurchase(req, res));
router.put('/:id', requireAuth, requireAdmin, (req, res) => purchaseController.updatePurchase(req, res));
router.delete('/:id', requireAuth, requireAdmin, (req, res) => purchaseController.deletePurchase(req, res));

export default router;
