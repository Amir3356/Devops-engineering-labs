import productService from '../services/product.service.js';
import { success, error } from '../../utils/response.js';

class ProductController {
  async getProducts(req, res) {
    try {
      const products = await productService.getProducts(req.query);
      return success(res, products, 'Products retrieved successfully');
    } catch (err) {
      return error(res, err.message, err.status || 500);
    }
  }

  async getProductById(req, res) {
    try {
      const product = await productService.getProductById(req.params.id);
      return success(res, product, 'Product details retrieved successfully');
    } catch (err) {
      return error(res, err.message, err.status || 500);
    }
  }

  async createProduct(req, res) {
    try {
      const created = await productService.createProduct(req.body);
      return success(res, created, 'Product created successfully', 201);
    } catch (err) {
      return error(res, err.message, err.status || 400);
    }
  }

  async updateProduct(req, res) {
    try {
      const updated = await productService.updateProduct(req.params.id, req.body);
      return success(res, updated, 'Product updated successfully');
    } catch (err) {
      return error(res, err.message, err.status || 400);
    }
  }

  async deleteProduct(req, res) {
    try {
      const result = await productService.deleteProduct(req.params.id);
      return success(res, result, 'Product deleted successfully');
    } catch (err) {
      return error(res, err.message, err.status || 500);
    }
  }

  async getCategories(req, res) {
    try {
      const categories = await productService.getCategories();
      return success(res, categories, 'Categories retrieved successfully');
    } catch (err) {
      return error(res, err.message, err.status || 500);
    }
  }

  async createCategory(req, res) {
    try {
      const category = await productService.createCategory(req.body);
      return success(res, category, 'Category created successfully', 201);
    } catch (err) {
      return error(res, err.message, err.status || 400);
    }
  }
}

export default new ProductController();
