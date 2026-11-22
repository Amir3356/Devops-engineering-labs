import pool from '../config/db.js';
import PaymentModel from '../models/payment.model.js';

/**
 * Payment Repository (PostgreSQL Implementation)
 * Encapsulates access to the isolated 'payment_db' database.
 */
class PaymentRepository {
  constructor() {
    this.ready = this.initSchema();
  }

  async initSchema() {
    try {
      await pool.query(`
        CREATE TABLE IF NOT EXISTS payments (
          id VARCHAR(64) PRIMARY KEY,
          order_id VARCHAR(64) NOT NULL,
          customer_id VARCHAR(64) NOT NULL,
          amount NUMERIC(10, 2) NOT NULL,
          currency VARCHAR(8) DEFAULT 'USD',
          payment_method VARCHAR(32) NOT NULL DEFAULT 'Card',
          status VARCHAR(32) NOT NULL DEFAULT 'Success',
          transaction_ref VARCHAR(64) NOT NULL,
          created_at TIMESTAMPTZ DEFAULT NOW()
        );
      `);

    } catch (err) {
      console.error('[Payment Repository] PostgreSQL init error:', err.message);
    }
  }

  mapRow(r) {
    if (!r) return null;
    return new PaymentModel({
      id: r.id,
      orderId: r.order_id,
      customerId: r.customer_id,
      amount: parseFloat(r.amount),
      currency: r.currency,
      paymentMethod: r.payment_method,
      status: r.status,
      transactionRef: r.transaction_ref,
      createdAt: r.created_at ? new Date(r.created_at).toISOString() : new Date().toISOString()
    });
  }

  async create(paymentData) {
    await this.ready;
    const model = new PaymentModel(paymentData);
    const sql = `
      INSERT INTO payments (id, order_id, customer_id, amount, currency, payment_method, status, transaction_ref, created_at)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      RETURNING *;
    `;
    const values = [
      model.id,
      model.orderId,
      model.customerId,
      model.amount,
      model.currency,
      model.paymentMethod,
      model.status,
      model.transactionRef,
      model.createdAt
    ];
    const res = await pool.query(sql, values);
    return this.mapRow(res.rows[0]);
  }

  async findById(id) {
    await this.ready;
    const res = await pool.query('SELECT * FROM payments WHERE id = $1', [id]);
    return this.mapRow(res.rows[0]);
  }

  async findByOrderId(orderId) {
    await this.ready;
    const res = await pool.query('SELECT * FROM payments WHERE order_id = $1', [orderId]);
    return this.mapRow(res.rows[0]);
  }

  async findByCustomerId(customerId) {
    await this.ready;
    const res = await pool.query('SELECT * FROM payments WHERE customer_id = $1 ORDER BY created_at DESC', [customerId]);
    return res.rows.map(r => this.mapRow(r));
  }

  async findAll() {
    await this.ready;
    const res = await pool.query('SELECT * FROM payments ORDER BY created_at DESC');
    return res.rows.map(r => this.mapRow(r));
  }

  async getSalesReport() {
    await this.ready;
    const totalRes = await pool.query(`
      SELECT 
        COUNT(*) as total_transactions,
        COALESCE(SUM(CASE WHEN status = 'Success' THEN amount ELSE 0 END), 0) as total_revenue,
        COUNT(CASE WHEN status = 'Success' THEN 1 END) as successful_transactions,
        COUNT(CASE WHEN status = 'Failed' THEN 1 END) as failed_transactions
      FROM payments;
    `);

    const methodRes = await pool.query(`
      SELECT payment_method, COUNT(*) as count, SUM(amount) as total
      FROM payments
      WHERE status = 'Success'
      GROUP BY payment_method;
    `);

    return {
      summary: {
        totalRevenue: parseFloat(totalRes.rows[0].total_revenue),
        totalTransactions: parseInt(totalRes.rows[0].total_transactions, 10),
        successfulTransactions: parseInt(totalRes.rows[0].successful_transactions, 10),
        failedTransactions: parseInt(totalRes.rows[0].failed_transactions, 10)
      },
      byMethod: methodRes.rows.map(r => ({
        method: r.payment_method,
        count: parseInt(r.count, 10),
        total: parseFloat(r.total)
      }))
    };
  }
}

export default new PaymentRepository();
