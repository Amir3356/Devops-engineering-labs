import pool from '../config/db.js';
import PurchaseModel from '../models/purchase.model.js';

class PurchaseRepository {
  constructor() {
    this.ready = this.initSchema();
  }

  async initSchema() {
    try {
      await pool.query(`
        CREATE TABLE IF NOT EXISTS purchases (
          id VARCHAR(64) PRIMARY KEY,
          batch_id VARCHAR(64) NOT NULL,
          product_name VARCHAR(128) NOT NULL,
          category VARCHAR(64) NOT NULL,
          quantity INT NOT NULL DEFAULT 1,
          supplier VARCHAR(128),
          unit_cost NUMERIC(10, 2) DEFAULT 0.00,
          total_cost NUMERIC(10, 2) DEFAULT 0.00,
          status VARCHAR(32) DEFAULT 'Received',
          created_at TIMESTAMPTZ DEFAULT NOW()
        );
      `);
    } catch (err) {
      console.error('[Purchase Repository] PostgreSQL schema init error:', err.message);
    }
  }

  mapRow(r) {
    if (!r) return null;
    return new PurchaseModel({
      id: r.id,
      batchId: r.batch_id,
      productName: r.product_name,
      category: r.category,
      quantity: r.quantity,
      supplier: r.supplier,
      unitCost: r.unit_cost,
      totalCost: r.total_cost,
      status: r.status,
      createdAt: r.created_at ? new Date(r.created_at).toISOString() : new Date().toISOString()
    });
  }

  async findAll() {
    await this.ready;
    const res = await pool.query('SELECT * FROM purchases ORDER BY created_at DESC');
    return res.rows.map(r => this.mapRow(r));
  }

  async findById(id) {
    await this.ready;
    const res = await pool.query('SELECT * FROM purchases WHERE id = $1', [id]);
    return this.mapRow(res.rows[0]);
  }

  async create(data) {
    await this.ready;
    const id = data.id || `pur-${Date.now()}`;
    const res = await pool.query(
      `INSERT INTO purchases (id, batch_id, product_name, category, quantity, supplier, unit_cost, total_cost, status, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
       RETURNING *`,
      [
        id,
        data.batchId,
        data.productName,
        data.category || 'General',
        data.quantity || 1,
        data.supplier || '',
        data.unitCost || 0.0,
        data.totalCost || 0.0,
        data.status || 'Received',
        data.createdAt || new Date().toISOString()
      ]
    );
    return this.mapRow(res.rows[0]);
  }

  async update(id, data) {
    await this.ready;
    const res = await pool.query(
      `UPDATE purchases
       SET product_name = COALESCE($2, product_name),
           category = COALESCE($3, category),
           quantity = COALESCE($4, quantity),
           supplier = COALESCE($5, supplier),
           unit_cost = COALESCE($6, unit_cost),
           total_cost = COALESCE($7, total_cost),
           status = COALESCE($8, status)
       WHERE id = $1
       RETURNING *`,
      [
        id,
        data.productName,
        data.category,
        data.quantity,
        data.supplier,
        data.unitCost,
        data.totalCost,
        data.status
      ]
    );
    return this.mapRow(res.rows[0]);
  }

  async delete(id) {
    await this.ready;
    const res = await pool.query('DELETE FROM purchases WHERE id = $1 RETURNING *', [id]);
    return this.mapRow(res.rows[0]);
  }
}

export default new PurchaseRepository();
