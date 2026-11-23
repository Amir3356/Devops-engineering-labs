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
      `);
    } catch (err) {
      console.error('[Inventory Repository] PostgreSQL init error:', err.message);
    }
  }

  mapRow(r) {
    if (!r) return null;
    return new InventoryModel({
      productId: r.product_id,
      productName: r.product_name,
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
