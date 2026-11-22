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

      // Seed categories if empty
      const catCountRes = await pool.query('SELECT COUNT(*) FROM categories');
      if (parseInt(catCountRes.rows[0].count, 10) === 0) {
        await pool.query(`
          INSERT INTO categories (id, name, slug, description)
          VALUES 
            ('cat-audio', 'Audio', 'audio', 'Headphones, earbuds, and premium sound systems'),
            ('cat-electronics', 'Electronics', 'electronics', 'Keyboards, gaming mice, monitors, and components'),
            ('cat-wearables', 'Wearables', 'wearables', 'Smartwatches, fitness bands, and trackers'),
            ('cat-accessories', 'Accessories', 'accessories', 'Fast chargers, cables, and protective cases')
          ON CONFLICT (id) DO NOTHING;
        `);
      }

      // Seed products if empty
      const prodCountRes = await pool.query('SELECT COUNT(*) FROM products');
      if (parseInt(prodCountRes.rows[0].count, 10) === 0) {
        await pool.query(`
          INSERT INTO products (id, name, category, price, stock, rating, description, image)
          VALUES 
            ('prod-001', 'AeroPulse Wireless Noise-Cancelling Headphones', 'Audio', 249.99, 18, 4.8, 'High-fidelity acoustic drivers with 40-hour battery life and adaptive hybrid noise cancellation.', 'https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=600&auto=format&fit=crop&q=80'),
            ('prod-002', 'Quantum Lumina Mechanical Keyboard (RGB)', 'Electronics', 139.50, 4, 4.9, 'Aircraft-grade anodized aluminum frame with hot-swappable linear mechanical switches and per-key RGB backlighting.', 'https://images.unsplash.com/photo-1587829741301-dc798b83add3?w=600&auto=format&fit=crop&q=80'),
            ('prod-003', 'Titan Pro Ultra Smartwatch', 'Wearables', 329.00, 12, 4.7, 'Sapphire glass display with continuous ECG tracking, dual-frequency GPS, and 100m water resistance.', 'https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=600&auto=format&fit=crop&q=80'),
            ('prod-004', 'OpticGlide Ergonomic Wireless Mouse', 'Electronics', 79.99, 25, 4.6, 'Sculpted ergonomic grip with hyper-fast MagSpeed scrolling and 8,000 DPI track-on-glass sensor.', 'https://images.unsplash.com/photo-1615663245857-ac93bb7c39e7?w=600&auto=format&fit=crop&q=80'),
            ('prod-005', 'SonicSphere 360 Portable Bluetooth Speaker', 'Audio', 119.00, 3, 4.5, 'Deep spatial 360-degree acoustic projection with IPX7 waterproof enclosure and 15-hour playtime.', 'https://images.unsplash.com/photo-1545454675-3531b543be5d?w=600&auto=format&fit=crop&q=80'),
            ('prod-006', 'HyperCharge 65W GaN Fast Charger', 'Accessories', 49.99, 40, 4.8, 'Next-generation Gallium Nitride (GaN) fast charger with dual USB-C Power Delivery ports.', 'https://images.unsplash.com/photo-1583863788434-e58a36330cf0?w=600&auto=format&fit=crop&q=80')
          ON CONFLICT (id) DO NOTHING;
        `);
        console.log('[Product DB] Seeded catalog into PostgreSQL product_db.');
      }
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
