import pool from '../config/db.js';
import OrderModel from '../models/order.model.js';
import { ensureOutboxTable } from '../../utils/events/index.js';

/**
 * Order Repository (PostgreSQL Implementation)
 * Encapsulates access to the isolated 'order_db' database.
 */
class OrderRepository {
  constructor() {
    this.ready = this.initSchema();
  }

  async initSchema() {
    try {
      await pool.query(`
        CREATE TABLE IF NOT EXISTS orders (
          id VARCHAR(64) PRIMARY KEY,
          customer_id VARCHAR(64) NOT NULL,
          customer_phone VARCHAR(32),
          items JSONB NOT NULL,
          total_amount NUMERIC(10, 2) NOT NULL,
          shipping_address JSONB,
          status VARCHAR(32) NOT NULL DEFAULT 'Pending',
          payment_id VARCHAR(64),
          payment_status VARCHAR(32) DEFAULT 'Pending',
          created_at TIMESTAMPTZ DEFAULT NOW(),
          updated_at TIMESTAMPTZ DEFAULT NOW()
        );
        -- Order saga: receipt contact and the reason a stock reservation was rejected
        ALTER TABLE orders ADD COLUMN IF NOT EXISTS customer_email VARCHAR(255);
        ALTER TABLE orders ADD COLUMN IF NOT EXISTS customer_name VARCHAR(128);
        ALTER TABLE orders ADD COLUMN IF NOT EXISTS status_reason TEXT;
        -- Idempotent checkout: one order per (customer, checkout attempt)
        ALTER TABLE orders ADD COLUMN IF NOT EXISTS idempotency_key VARCHAR(64);
        CREATE UNIQUE INDEX IF NOT EXISTS orders_customer_idempotency_key_uidx
          ON orders (customer_id, idempotency_key) WHERE idempotency_key IS NOT NULL;
      `);
      // Events written in the same transaction as the order (transactional outbox)
      await ensureOutboxTable(pool);
    } catch (err) {
      console.error('[Order Repository] PostgreSQL init error:', err.message);
    }
  }

  mapRow(r) {
    if (!r) return null;
    return new OrderModel({
      id: r.id,
      customerId: r.customer_id,
      customerPhone: r.customer_phone,
      items: typeof r.items === 'string' ? JSON.parse(r.items) : (r.items || []),
      totalAmount: parseFloat(r.total_amount),
      shippingAddress: typeof r.shipping_address === 'string' ? JSON.parse(r.shipping_address) : (r.shipping_address || {}),
      status: r.status,
      paymentId: r.payment_id,
      paymentStatus: r.payment_status,
      customerEmail: r.customer_email,
      customerName: r.customer_name,
      statusReason: r.status_reason,
      idempotencyKey: r.idempotency_key,
      createdAt: r.created_at ? new Date(r.created_at).toISOString() : new Date().toISOString(),
      updatedAt: r.updated_at ? new Date(r.updated_at).toISOString() : new Date().toISOString()
    });
  }

  /** `db` is the pool, or a transaction client from withTransaction(). */
  async create(orderData, db = pool) {
    await this.ready;
    const model = new OrderModel(orderData);
    const sql = `
      INSERT INTO orders (id, customer_id, customer_phone, items, total_amount, shipping_address, status, payment_id, payment_status, created_at, updated_at, customer_email, customer_name, idempotency_key)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
      RETURNING *;
    `;
    const values = [
      model.id,
      model.customerId,
      model.customerPhone,
      JSON.stringify(model.items),
      model.totalAmount,
      JSON.stringify(model.shippingAddress),
      model.status,
      model.paymentId,
      model.paymentStatus,
      model.createdAt,
      model.updatedAt,
      model.customerEmail,
      model.customerName,
      model.idempotencyKey
    ];
    const res = await db.query(sql, values);
    return this.mapRow(res.rows[0]);
  }

  async findByIdempotencyKey(customerId, idempotencyKey) {
    await this.ready;
    const res = await pool.query(
      'SELECT * FROM orders WHERE customer_id = $1 AND idempotency_key = $2',
      [customerId, idempotencyKey]
    );
    return this.mapRow(res.rows[0]);
  }

  /** Lock the order row inside a transaction (saga steps must not interleave). */
  async findByIdForUpdate(id, db) {
    await this.ready;
    const res = await db.query('SELECT * FROM orders WHERE id = $1 FOR UPDATE', [id]);
    return this.mapRow(res.rows[0]);
  }

  /** Saga transition: set status, payment status and (optionally) the reason in one statement. */
  async transition(id, { status, paymentStatus = null, statusReason = null }, db = pool) {
    await this.ready;
    const res = await db.query(
      `UPDATE orders
       SET status = $1, payment_status = COALESCE($2, payment_status), status_reason = $3, updated_at = NOW()
       WHERE id = $4 RETURNING *`,
      [status, paymentStatus, statusReason, id]
    );
    return this.mapRow(res.rows[0]);
  }

  async findById(id) {
    await this.ready;
    const res = await pool.query('SELECT * FROM orders WHERE id = $1', [id]);
    return this.mapRow(res.rows[0]);
  }

  async findByCustomerId(customerId) {
    await this.ready;
    const res = await pool.query('SELECT * FROM orders WHERE customer_id = $1 ORDER BY created_at DESC', [customerId]);
    return res.rows.map(r => this.mapRow(r));
  }

  async findAll() {
    await this.ready;
    const res = await pool.query('SELECT * FROM orders ORDER BY created_at DESC');
    return res.rows.map(r => this.mapRow(r));
  }

  async updateStatus(id, status, paymentId = null, paymentStatus = null, db = pool) {
    await this.ready;
    let sql = 'UPDATE orders SET status = $1, updated_at = NOW()';
    const params = [status];

    if (paymentId) {
      params.push(paymentId);
      sql += `, payment_id = $${params.length}`;
    }
    if (paymentStatus) {
      params.push(paymentStatus);
      sql += `, payment_status = $${params.length}`;
    }

    params.push(id);
    sql += ` WHERE id = $${params.length} RETURNING *;`;

    const res = await db.query(sql, params);
    return this.mapRow(res.rows[0]);
  }

  async cancelOrder(id, db = pool) {
    return this.updateStatus(id, 'Cancelled', null, null, db);
  }
}

export default new OrderRepository();
