import pool from '../config/db.js';
import PolicyModel from '../models/policy.model.js';

/**
 * Policy Repository (PostgreSQL)
 * Encapsulates access to the isolated 'policy_db' database.
 */
class PolicyRepository {
  constructor() {
    this.ready = this.initSchema();
  }

  async initSchema() {
    try {
      await pool.query(`
        CREATE TABLE IF NOT EXISTS policies (
          key VARCHAR(64) PRIMARY KEY,
          settings JSONB NOT NULL DEFAULT '{}'::jsonb,
          updated_by VARCHAR(64),
          updated_at TIMESTAMPTZ DEFAULT NOW()
        );
      `);
    } catch (err) {
      console.error('[Policy Repository] PostgreSQL init error:', err.message);
    }
  }

  mapRow(r) {
    if (!r) return null;
    return new PolicyModel({
      key: r.key,
      settings: r.settings,
      updatedBy: r.updated_by,
      updatedAt: r.updated_at ? new Date(r.updated_at).toISOString() : null
    });
  }

  async findByKey(key) {
    await this.ready;
    const res = await pool.query('SELECT * FROM policies WHERE key = $1', [key]);
    return this.mapRow(res.rows[0]);
  }

  async findAll() {
    await this.ready;
    const res = await pool.query('SELECT * FROM policies ORDER BY key ASC');
    return res.rows.map((r) => this.mapRow(r));
  }

  async upsert(key, settings, updatedBy) {
    await this.ready;
    const res = await pool.query(
      `INSERT INTO policies (key, settings, updated_by, updated_at)
       VALUES ($1, $2::jsonb, $3, NOW())
       ON CONFLICT (key) DO UPDATE SET
         settings = EXCLUDED.settings,
         updated_by = EXCLUDED.updated_by,
         updated_at = NOW()
       RETURNING *`,
      [key, JSON.stringify(settings), updatedBy || null]
    );
    return this.mapRow(res.rows[0]);
  }

  async delete(key) {
    await this.ready;
    const res = await pool.query('DELETE FROM policies WHERE key = $1 RETURNING key', [key]);
    return res.rowCount > 0;
  }
}

export default new PolicyRepository();
