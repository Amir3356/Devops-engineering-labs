import express from 'express';
import authRoutes from './auth.routes.js';
import userRoutes from './user.routes.js';
import productRoutes from './product.routes.js';
import purchaseRoutes from './purchase.routes.js';
import orderRoutes from './order.routes.js';
import saleRoutes from './sale.routes.js';
import inventoryRoutes from './inventory.routes.js';
import notificationRoutes from './notification.routes.js';
import policyRoutes from './policy.routes.js';

const router = express.Router();

// Mount individual microservice routes
router.use('/api/auth', authRoutes);
router.use('/api/users', userRoutes);
router.use('/api/products', productRoutes);
router.use('/api/purchases', purchaseRoutes);
router.use('/api/orders', orderRoutes);
router.use('/api/sales', saleRoutes);
router.use('/api/inventory', inventoryRoutes);
router.use('/api/notifications', notificationRoutes);
router.use('/api/policies', policyRoutes);

export default router;
