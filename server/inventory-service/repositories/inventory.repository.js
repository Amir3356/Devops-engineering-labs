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

      // Seed initial inventory matching catalog products if empty
      const countRes = await pool.query('SELECT COUNT(*) FROM inventory_stock');
      if (parseInt(countRes.rows[0].count, 10) === 0) {
        const seedItems = [
          { product_id: 'prod-001', product_name: 'Wireless Noise-Canceling Headphones', stock_quantity: 45, low_stock_threshold: 5 },
          { product_id: 'prod-002', product_name: 'Ultra-HD Smart Watch V2', stock_quantity: 18, low_stock_threshold: 5 },
          { product_id: 'prod-003', product_name: 'Ergonomic Mechanical Keyboard', stock_quantity: 32, low_stock_threshold: 5 },
          { product_id: 'prod-004', product_name: 'Minimalist Leather Backpack', stock_quantity: 4, low_stock_threshold: 5 }, // Low stock!
          { product_id: 'prod-005', product_name: 'Smart Ambient Desk Lamp', stock_quantity: 25, low_stock_threshold: 5 },
          { product_id: 'prod-006', product_name: 'Ceramic Pour-Over Coffee Set', stock_quantity: 2, low_stock_threshold: 5 }, // Low stock!
          { product_id: 'prod-007', product_name: 'Portable Bluetooth Speaker', stock_quantity: 50, low_stock_threshold: 5 },
          { product_id: 'prod-008', product_name: 'Organic Cotton Crewneck', stock_quantity: 60, low_stock_threshold: 5 }
        ];

        for (const item of seedItems) {
          await pool.query(`
            INSERT INTO inventory_stock (product_id, product_name, stock_quantity, low_stock_threshold)
            VALUES ($1, $2, $3, $4)
            ON CONFLICT (product_id) DO NOTHING;
          `, [item.product_id, item.product_name, item.stock_quantity, item.low_stock_threshold]);
        }
        console.log('[Inventory DB] Seeded demo inventory into inventory_db.');
      }
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
