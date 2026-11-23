import express from 'express';
import productController from '../controllers/product.controller.js';
import { requireAdmin } from '../middleware/auth.middleware.js';
import { requireAbility } from '../../utils/ability.js';
import { validateBody, createProductSchema } from '../../utils/validation.js';
import { uploadMiddleware } from '../../utils/upload.js';
import { uploadToMinio } from '../../utils/minio.js';
import { success, error } from '../../utils/response.js';

const router = express.Router();

// Multer Image Upload Endpoint (MinIO storage)
router.post('/upload', requireAdmin, (req, res) => {
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
      console.error('[MinIO Product Service Upload Error]:', uploadErr);
      return error(res, uploadErr.message || 'MinIO upload failed', 500);
    }
  });
});

// Public Category Endpoints
router.get('/categories', (req, res) => productController.getCategories(req, res));
router.post('/categories', requireAdmin, requireAbility('manage', 'Product'), (req, res) => productController.createCategory(req, res));

// Public Catalog Endpoints (search, filter, view)
router.get('/', (req, res) => productController.getProducts(req, res));
router.get('/:id', (req, res) => productController.getProductById(req, res));

// Administrator Protected Product CRUD with CASL & Zod
router.post('/', requireAdmin, requireAbility('create', 'Product'), validateBody(createProductSchema), (req, res) => productController.createProduct(req, res));
router.put('/:id', requireAdmin, requireAbility('manage', 'Product'), (req, res) => productController.updateProduct(req, res));
router.delete('/:id', requireAdmin, requireAbility('manage', 'Product'), (req, res) => productController.deleteProduct(req, res));

export default router;
