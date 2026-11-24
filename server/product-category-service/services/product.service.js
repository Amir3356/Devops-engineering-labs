import productRepository from '../repositories/product.repository.js';
import { countPurchasesForProduct } from './purchaseLookup.js';
import ProductModel from '../models/product.model.js';

class ProductService {
  async getProducts(query) {
    const products = await productRepository.findAll(query);
    return products.map(p => p.toJSON());
  }

  async getProductById(id) {
    const product = await productRepository.findById(id);
    if (!product) {
      const err = new Error(`Product with ID "${id}" not found`);
      err.status = 404;
      throw err;
    }
    return product.toJSON();
  }

  async createProduct(productData) {
    ProductModel.validate(productData);
    const created = await productRepository.create(productData);
    return created.toJSON();
  }

  /** Purchased products are locked: they can no longer be edited or deleted. */
  async assertNotPurchased(product, action) {
    const count = await countPurchasesForProduct(product.name);
    if (count > 0) {
      const err = new Error(
        `"${product.name}" cannot be ${action}: it has ${count} purchase batch${count === 1 ? '' : 'es'} recorded.`
      );
      err.status = 409;
      throw err;
    }
  }

  async updateProduct(id, updates) {
    const existing = await productRepository.findById(id);
    if (!existing) {
      const err = new Error(`Product with ID "${id}" not found`);
      err.status = 404;
      throw err;
    }
    await this.assertNotPurchased(existing, 'edited');
    const updated = await productRepository.update(id, updates);
    if (!updated) {
      const err = new Error(`Product with ID "${id}" not found`);
      err.status = 404;
      throw err;
    }
    return updated.toJSON();
  }

  async deleteProduct(id) {
    const existing = await productRepository.findById(id);
    if (!existing) {
      const err = new Error(`Product with ID "${id}" not found`);
      err.status = 404;
      throw err;
    }
    await this.assertNotPurchased(existing, 'deleted');
    await productRepository.delete(id);
    return { id, deleted: true };
  }

  async getCategories() {
    const categories = await productRepository.findAllCategories();
    return categories.map(c => c.toJSON());
  }

  async createCategory(categoryData) {
    if (!categoryData.name) {
      const err = new Error('Category name is required');
      err.status = 400;
      throw err;
    }
    const created = await productRepository.createCategory(categoryData);
    return created.toJSON();
  }
}

export default new ProductService();
