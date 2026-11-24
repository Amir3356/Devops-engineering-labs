import pool from '../config/db.js';
import InventoryModel from '../models/inventory.model.js';

/**
 * Inventory Repository (PostgreSQL Implementation)
 * Encapsulates access to the isolated 'inventory_db' database.
 */
class InventoryRepository {
  constructor() {
    this.ready = this.initSchema();
  }

  async initSchema() {
    try {
      await pool.query(`
        CREATE TABLE IF NOT EXISTS inventory_stock (
          product_id VARCHAR(64) PRIMARY KEY,
          product_name VARCHAR(128) NOT NULL,
          stock_quantity INT NOT NULL DEFAULT 0,
          low_stock_threshold INT NOT NULL DEFAULT 5,
          updated_at TIMESTAMPTZ DEFAULT NOW()
        );
        -- Batch details recorded when stock is added from a purchase batch
        ALTER TABLE inventory_stock ADD COLUMN IF NOT EXISTS batch_id VARCHAR(64);
        ALTER TABLE inventory_stock ADD COLUMN IF NOT EXISTS category VARCHAR(128);
        ALTER TABLE inventory_stock ADD COLUMN IF NOT EXISTS expires_at DATE;
      `);
    } catch (err) {
      console.error('[Inventory Repository] PostgreSQL init error:', err.message);
    }
  }

  // DATE columns come back as local-midnight Date objects; keep them as YYYY-MM-DD
  static toDateOnly(value) {
    if (!value) return null;
    if (typeof value === 'string') return value.slice(0, 10);
    const pad = (n) => String(n).padStart(2, '0');
    return `${value.getFullYear()}-${pad(value.getMonth() + 1)}-${pad(value.getDate())}`;
  }

  mapRow(r) {
    if (!r) return null;
    return new InventoryModel({
      productId: r.product_id,
      productName: r.product_name,
      category: r.category,
      batchId: r.batch_id,
      expiresAt: InventoryRepository.toDateOnly(r.expires_at),
      stockQuantity: r.stock_quantity,
      lowStockThreshold: r.low_stock_threshold,
      updatedAt: r.updated_at ? new Date(r.updated_at).toISOString() : new Date().toISOString()
    });
  }

  async findAll() {
    await this.ready;
    const res = await pool.query('SELECT * FROM inventory_stock ORDER BY product_id ASC');
    return res.rows.map(r => this.mapRow(r));
  }

  async findByProductId(productId) {
    await this.ready;
    const res = await pool.query('SELECT * FROM inventory_stock WHERE product_id = $1', [productId]);
    return this.mapRow(res.rows[0]);
  }

  async getLowStock() {
    await this.ready;
    const res = await pool.query('SELECT * FROM inventory_stock WHERE stock_quantity <= low_stock_threshold ORDER BY stock_quantity ASC');
    return res.rows.map(r => this.mapRow(r));
  }

  async updateStock(productId, stockQuantity, productName = null) {
    await this.ready;
    let sql;
    let params;

    if (productName) {
      sql = `
        INSERT INTO inventory_stock (product_id, product_name, stock_quantity, updated_at)
        VALUES ($1, $2, $3, NOW())
        ON CONFLICT (product_id) 
        DO UPDATE SET stock_quantity = EXCLUDED.stock_quantity, product_name = EXCLUDED.product_name, updated_at = NOW()
        RETURNING *;
      `;
      params = [productId, productName, stockQuantity];
    } else {
      sql = `
        UPDATE inventory_stock
        SET stock_quantity = $1, updated_at = NOW()
        WHERE product_id = $2
        RETURNING *;
      `;
      params = [stockQuantity, productId];
    }

    const res = await pool.query(sql, params);
    return this.mapRow(res.rows[0]);
  }

  async deductStock(productId, quantity) {
    await this.ready;
    const res = await pool.query(`
      UPDATE inventory_stock
      SET stock_quantity = GREATEST(0, stock_quantity - $1), updated_at = NOW()
      WHERE product_id = $2 AND stock_quantity >= $1
      RETURNING *;
    `, [quantity, productId]);

    return this.mapRow(res.rows[0]);
  }

  /**
   * Add stock from a purchase batch. Creates the product's stock row if needed
   * and records the latest batch id, category and expiry date.
   */
  async addBatchStock({ productId, productName, category, batchId, expiresAt, quantity }) {
    await this.ready;
    const res = await pool.query(`
      INSERT INTO inventory_stock (product_id, product_name, stock_quantity, category, batch_id, expires_at, updated_at)
      VALUES ($1, $2, $3, $4, $5, $6, NOW())
      ON CONFLICT (product_id) DO UPDATE SET
        stock_quantity = inventory_stock.stock_quantity + EXCLUDED.stock_quantity,
        product_name = EXCLUDED.product_name,
        category = COALESCE(EXCLUDED.category, inventory_stock.category),
        batch_id = COALESCE(EXCLUDED.batch_id, inventory_stock.batch_id),
        expires_at = COALESCE(EXCLUDED.expires_at, inventory_stock.expires_at),
        updated_at = NOW()
      RETURNING *;
    `, [productId, productName, quantity, category || null, batchId || null, expiresAt || null]);

    return this.mapRow(res.rows[0]);
  }

  async replenishStock(productId, quantity) {
    await this.ready;
    const res = await pool.query(`
      UPDATE inventory_stock
      SET stock_quantity = stock_quantity + $1, updated_at = NOW()
      WHERE product_id = $2
      RETURNING *;
    `, [quantity, productId]);

    return this.mapRow(res.rows[0]);
  }
}

export default new InventoryRepository();
