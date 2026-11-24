import crypto from 'crypto';

/**
 * Product Model / Entity
 */
class ProductModel {
  constructor({ id, name, category, price, stock, rating, description, image, createdAt, updatedAt }) {
    this.id = id || `prod-${crypto.randomUUID().slice(0, 8)}`;
    this.name = (name || '').trim();
    this.category = (category || 'General').trim();
    this.price = price !== undefined && !isNaN(parseFloat(price)) ? Math.max(0, parseFloat(price)) : 0;
    this.stock = stock !== undefined && !isNaN(parseInt(stock, 10)) ? Math.max(0, parseInt(stock, 10)) : 0;
    this.rating = parseFloat(rating) || 5.0;
    this.description = (description || '').trim();
    this.image = image || 'https://images.unsplash.com/photo-1526170375885-4d8ecf77b99f?w=600&auto=format&fit=crop&q=80';
    this.createdAt = createdAt || new Date().toISOString();
    this.updatedAt = updatedAt || new Date().toISOString();
  }

  static validate(data) {
    if (!data.name || data.name.trim().length === 0) {
      throw new Error('Product name is required');
    }
    if (data.price !== undefined && data.price !== null && data.price !== '' && (isNaN(parseFloat(data.price)) || parseFloat(data.price) < 0)) {
      throw new Error('Valid non-negative price is required');
    }
    if (data.stock !== undefined && data.stock !== null && data.stock !== '' && (isNaN(parseInt(data.stock, 10)) || parseInt(data.stock, 10) < 0)) {
      throw new Error('Valid non-negative stock quantity is required');
    }
  }

  toJSON() {
    return {
      id: this.id,
      name: this.name,
      category: this.category,
      price: this.price,
      stock: this.stock,
      rating: this.rating,
      description: this.description,
      image: this.image,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt
    };
  }
}

export default ProductModel;
