import pool from '../config/db.js';
import bcrypt from 'bcryptjs';
import UserModel from '../models/user.model.js';

/**
 * User Repository (PostgreSQL Implementation)
 * Encapsulates access to the isolated 'user_db' database.
 */
class UserRepository {
  constructor() {
    this.ready = this.initSchema();
  }

  async initSchema() {
    try {
      await pool.query(`
        CREATE TABLE IF NOT EXISTS users (
          id VARCHAR(64) PRIMARY KEY,
          phone VARCHAR(32) UNIQUE NOT NULL,
          password VARCHAR(255) NOT NULL,
          role VARCHAR(16) NOT NULL DEFAULT 'customer',
          name VARCHAR(128) NOT NULL,
          created_at TIMESTAMPTZ DEFAULT NOW(),
          updated_at TIMESTAMPTZ DEFAULT NOW()
        );
      `);

      // Seed initial admin from environment variables if configured and table is empty
      const countRes = await pool.query('SELECT COUNT(*) FROM users');
      if (parseInt(countRes.rows[0].count, 10) === 0) {
        const adminEmail = process.env.ADMIN_EMAIL || 'amirsiraj1995@gmail.com';
        const adminPhone = process.env.ADMIN_PHONE || '+251938617803';
        const adminPassword = process.env.ADMIN_PASSWORD || 'AEHJSS36';
        if (adminEmail || adminPhone) {
          const salt = bcrypt.genSaltSync(10);
          const adminPasswordHash = bcrypt.hashSync(adminPassword, salt);
          await pool.query(`
            INSERT INTO users (id, email, phone, password, role, name)
            VALUES ($1, $2, $3, $4, 'admin', $5)
            ON CONFLICT (id) DO UPDATE SET email = EXCLUDED.email, password = EXCLUDED.password;
          `, ['usr-admin-001', adminEmail, adminPhone, adminPasswordHash, process.env.ADMIN_NAME || 'System Administrator']);
          console.log('[User DB] Seeded initial Admin account from environment variables.');
        }
      }
    } catch (err) {
      console.error('[User Repository] PostgreSQL init error:', err.message);
    }
  }

  mapRowToModel(row) {
    if (!row) return null;
    return new UserModel({
      id: row.id,
      phone: row.phone,
      password: row.password,
      role: row.role,
      name: row.name,
      createdAt: row.created_at ? new Date(row.created_at).toISOString() : new Date().toISOString(),
      updatedAt: row.updated_at ? new Date(row.updated_at).toISOString() : new Date().toISOString()
    });
  }

  async findAll() {
    await this.ready;
    const res = await pool.query('SELECT * FROM users ORDER BY created_at DESC');
    return res.rows.map(r => this.mapRowToModel(r));
  }

  async findById(id) {
    await this.ready;
    const res = await pool.query('SELECT * FROM users WHERE id = $1', [id]);
    return this.mapRowToModel(res.rows[0]);
  }

  async findByPhone(phone) {
    await this.ready;
    const cleanPhone = (phone || '').trim();
    const res = await pool.query('SELECT * FROM users WHERE phone = $1', [cleanPhone]);
    return this.mapRowToModel(res.rows[0]);
  }

  async create(userData) {
    await this.ready;
    const model = new UserModel(userData);
    const query = `
      INSERT INTO users (id, phone, password, role, name, created_at, updated_at)
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
    const res = await pool.query(query, values);
    return this.mapRowToModel(res.rows[0]);
  }

  async update(id, updates) {
    await this.ready;
    const query = `
      UPDATE users 
      SET 
        name = COALESCE($1, name),
        updated_at = NOW()
      WHERE id = $2
      RETURNING *;
    `;
    const res = await pool.query(query, [updates.name, id]);
    return this.mapRowToModel(res.rows[0]);
  }

  async delete(id) {
    await this.ready;
    const res = await pool.query('DELETE FROM users WHERE id = $1', [id]);
    return res.rowCount > 0;
  }
}

export default new UserRepository();
