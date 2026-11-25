import pool from '../config/db.js';
import SaleModel from '../models/sale.model.js';
import { ensureOutboxTable } from '../../utils/events/index.js';

class SaleRepository {
  constructor() {
    this.ready = this.initSchema();
  }

  async initSchema() {
    try {
      await pool.query(`
        CREATE TABLE IF NOT EXISTS sales (
          id VARCHAR(64) PRIMARY KEY,
          sale_id VARCHAR(64) NOT NULL,
          batch_id VARCHAR(64),
          product_id VARCHAR(64),
          product_name VARCHAR(128) NOT NULL,
          category VARCHAR(64),
          quantity INT NOT NULL DEFAULT 1,
          unit_price NUMERIC(10, 2) NOT NULL DEFAULT 0.00,
          total_amount NUMERIC(10, 2) NOT NULL DEFAULT 0.00,
          customer_name VARCHAR(128),
          customer_email VARCHAR(128),
          customer_phone VARCHAR(64),
          payment_status VARCHAR(32) DEFAULT 'Paid',
          fulfillment_status VARCHAR(32) DEFAULT 'Delivered',
          created_at TIMESTAMPTZ DEFAULT NOW()
        );
      `);
      // Events written in the same transaction as the sale (transactional outbox)
      await ensureOutboxTable(pool);
    } catch (err) {
      console.error('[Sale Repository] PostgreSQL schema init error:', err.message);
    }
  }

  mapRow(r) {
    if (!r) return null;
    return new SaleModel({
      id: r.id,
      saleId: r.sale_id,
      batchId: r.batch_id,
      productId: r.product_id,
      productName: r.product_name,
      category: r.category,
      quantity: r.quantity,
      unitPrice: r.unit_price,
      totalAmount: r.total_amount,
      customerName: r.customer_name,
      customerEmail: r.customer_email,
      customerPhone: r.customer_phone,
      paymentStatus: r.payment_status,
      fulfillmentStatus: r.fulfillment_status,
      createdAt: r.created_at ? new Date(r.created_at).toISOString() : new Date().toISOString()
    });
  }

  async findAll() {
    await this.ready;
    const res = await pool.query('SELECT * FROM sales ORDER BY created_at DESC');
    return res.rows.map(r => this.mapRow(r));
  }

  async findById(id) {
    await this.ready;
    const res = await pool.query('SELECT * FROM sales WHERE id = $1 OR sale_id = $1', [id]);
    return this.mapRow(res.rows[0]);
  }

  /** `db` is the pool, or a transaction client from withTransaction(). */
  async create(data, db = pool) {
    await this.ready;
    const id = data.id || `sale-${Date.now()}`;
    const saleId = data.saleId || `ord-${Date.now().toString().slice(-6)}`;
    const res = await db.query(
      `INSERT INTO sales (id, sale_id, batch_id, product_id, product_name, category, quantity, unit_price, total_amount, customer_name, customer_email, customer_phone, payment_status, fulfillment_status, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
       RETURNING *`,
      [
        id,
        saleId,
        data.batchId || '',
        data.productId || '',
        data.productName,
        data.category || 'General',
        data.quantity || 1,
        data.unitPrice || 0.0,
        data.totalAmount || 0.0,
        data.customerName || 'Direct Customer',
        data.customerEmail || '',
        data.customerPhone || '',
        data.paymentStatus || 'Paid',
        data.fulfillmentStatus || 'Delivered',
        data.createdAt || new Date().toISOString()
      ]
    );
    return this.mapRow(res.rows[0]);
  }

  async delete(id) {
    await this.ready;
    const res = await pool.query('DELETE FROM sales WHERE id = $1 OR sale_id = $1 RETURNING *', [id]);
    return this.mapRow(res.rows[0]);
  }
}

export default new SaleRepository();
