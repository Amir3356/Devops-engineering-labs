import productRepository from '../repositories/product.repository.js';
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

  async updateProduct(id, updates) {
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
