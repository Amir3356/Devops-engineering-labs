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

    const host = req.get('host') || 'localhost:5000';
    const protocol = req.protocol || 'http';
    const fileUrl = `${protocol}://${host}/uploads/${req.file.filename}`;

    return success(res, {
      url: fileUrl,
      relativePath: `/uploads/${req.file.filename}`,
      filename: req.file.filename,
      mimetype: req.file.mimetype,
      size: req.file.size
    }, 'Product image uploaded successfully via Multer', 201);
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
