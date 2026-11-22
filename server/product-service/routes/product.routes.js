import express from 'express';
import productController from '../controllers/product.controller.js';
import { requireAdmin } from '../middleware/auth.middleware.js';
import { requireAbility } from '../../utils/ability.js';
import { validateBody, createProductSchema } from '../../utils/validation.js';

const router = express.Router();

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
