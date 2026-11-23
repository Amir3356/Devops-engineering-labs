import pool from '../config/db.js';
import ProductModel from '../models/product.model.js';
import CategoryModel from '../models/category.model.js';

/**
 * Product & Category Repository (PostgreSQL Implementation)
 * Encapsulates access to the isolated 'product_db' database.
 */
class ProductRepository {
  constructor() {
    this.ready = this.initSchema();
  }

  async initSchema() {
    try {
      await pool.query(`
        CREATE TABLE IF NOT EXISTS categories (
          id VARCHAR(64) PRIMARY KEY,
          name VARCHAR(128) NOT NULL,
          slug VARCHAR(128) NOT NULL,
          description TEXT
        );

        CREATE TABLE IF NOT EXISTS products (
          id VARCHAR(64) PRIMARY KEY,
          name VARCHAR(255) NOT NULL,
          category VARCHAR(128) NOT NULL,
          price NUMERIC(10, 2) NOT NULL,
          stock INT NOT NULL DEFAULT 0,
          rating NUMERIC(3, 1) DEFAULT 5.0,
          description TEXT,
          image TEXT,
          created_at TIMESTAMPTZ DEFAULT NOW(),
          updated_at TIMESTAMPTZ DEFAULT NOW()
        );
      `);
    } catch (err) {
      console.error('[Product Repository] PostgreSQL init error:', err.message);
    }
  }

  mapRowToProduct(r) {
    if (!r) return null;
    return new ProductModel({
      id: r.id,
      name: r.name,
      category: r.category,
      price: parseFloat(r.price),
      stock: parseInt(r.stock, 10),
      rating: parseFloat(r.rating),
      description: r.description,
      image: r.image,
      createdAt: r.created_at ? new Date(r.created_at).toISOString() : new Date().toISOString(),
      updatedAt: r.updated_at ? new Date(r.updated_at).toISOString() : new Date().toISOString()
    });
  }

  mapRowToCategory(r) {
    if (!r) return null;
    return new CategoryModel({
      id: r.id,
      name: r.name,
      slug: r.slug,
      description: r.description
    });
  }

  async findAll(query = {}) {
    await this.ready;
    let sql = 'SELECT * FROM products WHERE 1=1';
    const params = [];

    if (query.category && query.category.toLowerCase() !== 'all') {
      params.push(query.category.trim());
      sql += ` AND LOWER(category) = LOWER($${params.length})`;
    }

    if (query.search) {
      params.push(`%${query.search.trim().toLowerCase()}%`);
      sql += ` AND (LOWER(name) LIKE $${params.length} OR LOWER(description) LIKE $${params.length})`;
    }

    if (query.minPrice) {
      params.push(parseFloat(query.minPrice));
      sql += ` AND price >= $${params.length}`;
    }

    if (query.maxPrice) {
      params.push(parseFloat(query.maxPrice));
      sql += ` AND price <= $${params.length}`;
    }

    if (query.sortBy === 'price-low') {
      sql += ' ORDER BY price ASC';
    } else if (query.sortBy === 'price-high') {
      sql += ' ORDER BY price DESC';
    } else if (query.sortBy === 'rating') {
      sql += ' ORDER BY rating DESC';
    } else {
      sql += ' ORDER BY created_at DESC';
    }

    const res = await pool.query(sql, params);
    return res.rows.map(r => this.mapRowToProduct(r));
  }

  async findById(id) {
    await this.ready;
    const res = await pool.query('SELECT * FROM products WHERE id = $1', [id]);
    return this.mapRowToProduct(res.rows[0]);
  }

  async create(productData) {
    await this.ready;
    const model = new ProductModel(productData);
    const sql = `
      INSERT INTO products (id, name, category, price, stock, rating, description, image, created_at, updated_at)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
      RETURNING *;
    `;
    const values = [
      model.id,
      model.name,
      model.category,
      model.price,
      model.stock,
      model.rating,
      model.description,
      model.image,
      model.createdAt,
      model.updatedAt
    ];
    const res = await pool.query(sql, values);
    return this.mapRowToProduct(res.rows[0]);
  }

  async update(id, updates) {
    await this.ready;
    const sql = `
      UPDATE products 
      SET 
        name = COALESCE($1, name),
        category = COALESCE($2, category),
        price = COALESCE($3, price),
        stock = COALESCE($4, stock),
        description = COALESCE($5, description),
        image = COALESCE($6, image),
        updated_at = NOW()
      WHERE id = $7
      RETURNING *;
    `;
    const values = [
      updates.name,
      updates.category,
      updates.price !== undefined ? parseFloat(updates.price) : null,
      updates.stock !== undefined ? parseInt(updates.stock, 10) : null,
      updates.description,
      updates.image,
      id
    ];
    const res = await pool.query(sql, values);
    return this.mapRowToProduct(res.rows[0]);
  }

  async delete(id) {
    await this.ready;
    const res = await pool.query('DELETE FROM products WHERE id = $1', [id]);
    return res.rowCount > 0;
  }

  async findAllCategories() {
    await this.ready;
    const res = await pool.query('SELECT * FROM categories ORDER BY name ASC');
    return res.rows.map(r => this.mapRowToCategory(r));
  }

  async createCategory(categoryData) {
    await this.ready;
    const model = new CategoryModel(categoryData);
    const sql = `
      INSERT INTO categories (id, name, slug, description)
      VALUES ($1, $2, $3, $4)
      RETURNING *;
    `;
    const res = await pool.query(sql, [model.id, model.name, model.slug, model.description]);
    return this.mapRowToCategory(res.rows[0]);
  }
}

export default new ProductRepository();
