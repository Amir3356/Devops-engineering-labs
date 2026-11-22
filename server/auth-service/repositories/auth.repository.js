import pool from '../config/db.js';
import AuthAccountModel from '../models/auth.model.js';

/**
 * Auth Repository (PostgreSQL Implementation)
 * Encapsulates access to the isolated 'auth_db' database.
 */
class AuthRepository {
  constructor() {
    this.ready = this.initSchema();
  }

  async initSchema() {
    try {
      await pool.query(`
        CREATE TABLE IF NOT EXISTS accounts (
          id VARCHAR(64) PRIMARY KEY,
          phone VARCHAR(32) UNIQUE NOT NULL,
          password VARCHAR(255) NOT NULL,
          role VARCHAR(16) NOT NULL DEFAULT 'customer',
          name VARCHAR(128) NOT NULL,
          created_at TIMESTAMPTZ DEFAULT NOW(),
          updated_at TIMESTAMPTZ DEFAULT NOW()
        );
      `);
    } catch (err) {
      console.error('[Auth Repository] PostgreSQL init error:', err.message);
    }
  }

  mapRow(r) {
    if (!r) return null;
    return new AuthAccountModel({
      id: r.id,
      phone: r.phone,
      password: r.password,
      role: r.role,
      name: r.name,
      createdAt: r.created_at ? new Date(r.created_at).toISOString() : new Date().toISOString(),
      updatedAt: r.updated_at ? new Date(r.updated_at).toISOString() : new Date().toISOString()
    });
  }

  async findByPhone(phone) {
    await this.ready;
    const cleanPhone = (phone || '').trim();
    const res = await pool.query('SELECT * FROM accounts WHERE phone = $1', [cleanPhone]);
    return this.mapRow(res.rows[0]);
  }

  async findById(id) {
    await this.ready;
    const res = await pool.query('SELECT * FROM accounts WHERE id = $1', [id]);
    return this.mapRow(res.rows[0]);
  }

  async create(accountData) {
    await this.ready;
    const model = new AuthAccountModel(accountData);
    const sql = `
      INSERT INTO accounts (id, phone, password, role, name, created_at, updated_at)
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING *;
    `;
    const values = [
      model.id,
      model.phone,
      model.password,
      model.role,
      model.name,
      model.createdAt,
      model.updatedAt
    ];
    const res = await pool.query(sql, values);
    return this.mapRow(res.rows[0]);
  }

  async findAll() {
    await this.ready;
    const res = await pool.query('SELECT * FROM accounts ORDER BY created_at DESC');
    return res.rows.map(r => this.mapRow(r));
  }
}

export default new AuthRepository();
