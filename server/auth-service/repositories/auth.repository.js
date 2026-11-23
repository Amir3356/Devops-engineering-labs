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
          email VARCHAR(128) UNIQUE,
          phone VARCHAR(32),
          password VARCHAR(255) NOT NULL,
          role VARCHAR(16) NOT NULL DEFAULT 'customer',
          name VARCHAR(128) NOT NULL,
          created_at TIMESTAMPTZ DEFAULT NOW(),
          updated_at TIMESTAMPTZ DEFAULT NOW()
        );
        ALTER TABLE accounts ADD COLUMN IF NOT EXISTS email VARCHAR(128) UNIQUE;
        ALTER TABLE accounts ALTER COLUMN phone DROP NOT NULL;
      `);
    } catch (err) {
      console.error('[Auth Repository] PostgreSQL init error:', err.message);
    }
  }

  mapRow(r) {
    if (!r) return null;
    return new AuthAccountModel({
      id: r.id,
      email: r.email,
      phone: r.phone,
      password: r.password,
      role: r.role,
      name: r.name,
      createdAt: r.created_at ? new Date(r.created_at).toISOString() : new Date().toISOString(),
      updatedAt: r.updated_at ? new Date(r.updated_at).toISOString() : new Date().toISOString()
    });
  }

  async findByIdentifier(identifier) {
    await this.ready;
    const clean = (identifier || '').trim().toLowerCase();
    const res = await pool.query(
      'SELECT * FROM accounts WHERE LOWER(email) = $1 OR phone = $1',
      [clean]
    );
    return this.mapRow(res.rows[0]);
  }

  async findByEmail(email) {
    return this.findByIdentifier(email);
  }

  async findByPhone(phone) {
    return this.findByIdentifier(phone);
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
      INSERT INTO accounts (id, email, phone, password, role, name, created_at, updated_at)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      RETURNING *;
    `;
    const values = [
      model.id,
      model.email || null,
      model.phone || null,
      model.password,
      model.role,
      model.name,
      model.createdAt,
      model.updatedAt
    ];
    const res = await pool.query(sql, values);
    return this.mapRow(res.rows[0]);
  }

  async update(id, updates) {
    await this.ready;
    const fields = [];
    const values = [];
    let idx = 1;

    for (const [key, val] of Object.entries(updates)) {
      fields.push(`${key} = $${idx++}`);
      values.push(val);
    }

    fields.push(`updated_at = NOW()`);
    values.push(id);

    const sql = `UPDATE accounts SET ${fields.join(', ')} WHERE id = $${idx} RETURNING *;`;
    const res = await pool.query(sql, values);
    return this.mapRow(res.rows[0]);
  }
}

export default new AuthRepository();
