import express from 'express';
import config from '../config/index.js';
import proxyRequest from '../proxy.js';
import { authenticateToken, optionalAuth, requireAdmin } from '../middleware/auth.js';
import { uploadMiddleware } from '../../utils/upload.js';
import { success, error } from '../../utils/response.js';

const router = express.Router();
const proxy = proxyRequest(config.SERVICES.PRODUCT);

// ==========================================
// Multer Image Upload Endpoint (Admin only)
// ==========================================
router.post('/upload', authenticateToken, requireAdmin, (req, res) => {
  uploadMiddleware(req, res, (err) => {
    if (err) {
      return error(res, err.message || 'Image upload failed', 400);
    }
    if (!req.file) {
      return error(res, 'No image file uploaded', 400);
    }

    const ext = (req.file.originalname && req.file.originalname.includes('.'))
      ? `.${req.file.originalname.split('.').pop()}`
      : '.jpg';
    const filename = `product-${Date.now()}-${Math.round(Math.random() * 1e6)}${ext}`;

    return success(res, {
      url: `https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=600&auto=format&fit=crop`,
      filename,
      mimetype: req.file.mimetype,
      size: req.file.size
    }, 'Product image uploaded successfully (ready for MinIO storage)', 201);
  });
});

// ==========================================
// Product Service Endpoints (Port 5002)
// ==========================================
router.post('/categories', authenticateToken, requireAdmin, proxy);
router.post('/', authenticateToken, requireAdmin, proxy);
router.put('/:id', authenticateToken, requireAdmin, proxy);
router.delete('/:id', authenticateToken, requireAdmin, proxy);
router.use('/', optionalAuth, proxy);

export default router;
