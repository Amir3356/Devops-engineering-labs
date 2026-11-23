import express from 'express';
import config from '../config/index.js';
import proxyRequest from '../proxy.js';
import { authenticateToken, optionalAuth, requireAdmin } from '../middleware/auth.js';
import { uploadMiddleware } from '../../utils/upload.js';
import { uploadToMinio } from '../../utils/minio.js';
import { success, error } from '../../utils/response.js';

const router = express.Router();
const proxy = proxyRequest(config.SERVICES.PRODUCT);

// ==========================================
// Multer Image Upload Endpoint (Admin only)
// Streams directly into MinIO Object Storage
// ==========================================
router.post('/upload', authenticateToken, requireAdmin, (req, res) => {
  uploadMiddleware(req, res, async (err) => {
    if (err) {
      return error(res, err.message || 'Image upload failed', 400);
    }
    if (!req.file) {
      return error(res, 'No image file uploaded', 400);
    }

    try {
      const uploadResult = await uploadToMinio(req.file.buffer, req.file.originalname, req.file.mimetype);
      return success(res, {
        url: uploadResult.url,
        imageUrl: uploadResult.url,
        filename: uploadResult.objectName,
        bucket: uploadResult.bucket,
        mimetype: req.file.mimetype,
        size: req.file.size
      }, 'Product image uploaded successfully to MinIO object storage', 201);
    } catch (uploadErr) {
      console.error('[MinIO Gateway Upload Error]:', uploadErr);
      return error(res, uploadErr.message || 'MinIO upload failed', 500);
    }
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
