import pool from '../config/db.js';
import bcrypt from 'bcryptjs';
import { getAdminCredentials, ADMIN_ACCOUNT_ID } from '../../utils/adminCredentials.js';
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
          email VARCHAR(128) UNIQUE,
          phone VARCHAR(32),
          password VARCHAR(255) NOT NULL,
          role VARCHAR(16) NOT NULL DEFAULT 'customer',
          name VARCHAR(128) NOT NULL,
          created_at TIMESTAMPTZ DEFAULT NOW(),
          updated_at TIMESTAMPTZ DEFAULT NOW()
        );
        ALTER TABLE users ADD COLUMN IF NOT EXISTS email VARCHAR(128) UNIQUE;
        ALTER TABLE users ALTER COLUMN phone DROP NOT NULL;
      `);

      // Seed initial admin from environment variables if configured and table is empty
      const countRes = await pool.query('SELECT COUNT(*) FROM users');
      if (parseInt(countRes.rows[0].count, 10) === 0) {
        let admin;
        try {
          admin = getAdminCredentials();
        } catch (credErr) {
          console.warn(`[User DB] Administrator not seeded: ${credErr.message}`);
        }
        if (admin) {
          const adminPasswordHash = await bcrypt.hash(admin.password, 10);
          await pool.query(`
            INSERT INTO users (id, email, phone, password, role, name)
            VALUES ($1, $2, NULL, $3, 'admin', $4)
            ON CONFLICT (id) DO UPDATE SET email = EXCLUDED.email, phone = NULL, password = EXCLUDED.password;
          `, [ADMIN_ACCOUNT_ID, admin.email, adminPasswordHash, admin.name]);
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
      email: row.email,
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
      INSERT INTO users (id, email, phone, password, role, name, created_at, updated_at)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      RETURNING *;
    `;
    const values = [
      model.id,
      model.email || null,
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
