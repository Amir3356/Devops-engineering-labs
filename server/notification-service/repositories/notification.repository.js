import pool from '../config/db.js';
import NotificationModel from '../models/notification.model.js';

/**
 * Notification Repository (PostgreSQL Implementation)
 * Encapsulates access to the isolated 'notification_db' database.
 */
class NotificationRepository {
  constructor() {
    this.ready = this.initSchema();
  }

  async initSchema() {
    try {
      await pool.query(`
        CREATE TABLE IF NOT EXISTS notifications (
          id VARCHAR(64) PRIMARY KEY,
          user_id VARCHAR(64) NOT NULL,
          title VARCHAR(128) NOT NULL,
          message TEXT NOT NULL,
          type VARCHAR(32) DEFAULT 'info',
          is_read BOOLEAN DEFAULT FALSE,
          created_at TIMESTAMPTZ DEFAULT NOW()
        );
        -- In-app notifications from events (same as migration 20261127000001_inapp_notifications)
        ALTER TABLE notifications
          ADD COLUMN IF NOT EXISTS category VARCHAR(32) DEFAULT 'general',
          ADD COLUMN IF NOT EXISTS data JSONB DEFAULT '{}'::jsonb,
          ADD COLUMN IF NOT EXISTS idempotency_key VARCHAR(160);
        CREATE UNIQUE INDEX IF NOT EXISTS notifications_idempotency_key_uq ON notifications (idempotency_key);
        CREATE INDEX IF NOT EXISTS notifications_user_unread_idx ON notifications (user_id, is_read, created_at DESC);
      `);
    } catch (err) {
      console.error('[Notification Repository] PostgreSQL init error:', err.message);
    }
  }

  mapRow(r) {
    if (!r) return null;
    return new NotificationModel({
      id: r.id,
      userId: r.user_id,
      title: r.title,
      message: r.message,
      type: r.type,
      category: r.category,
      data: r.data,
      isRead: r.is_read,
      createdAt: r.created_at ? new Date(r.created_at).toISOString() : new Date().toISOString()
    });
  }

  async create(data) {
    await this.ready;
    const model = new NotificationModel(data);
    const res = await pool.query(
      `INSERT INTO notifications (id, user_id, title, message, type, category, data, is_read, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       RETURNING *`,
      [model.id, model.userId, model.title, model.message, model.type, model.category,
        JSON.stringify(model.data), model.isRead, model.createdAt]
    );
    return this.mapRow(res.rows[0]);
  }

  /**
   * Insert a notification built from an event, inside the consumer's transaction (`db` = its client).
   * Returns null when the idempotency key already exists (event redelivered) — nothing is duplicated.
   */
  async insertFromEvent(db, { userId, title, message, type, category, data, idempotencyKey }) {
    await this.ready;
    const model = new NotificationModel({ userId, title, message, type, category, data });
    const res = await db.query(
      `INSERT INTO notifications (id, user_id, title, message, type, category, data, is_read, created_at, idempotency_key)
       VALUES ($1, $2, $3, $4, $5, $6, $7, FALSE, NOW(), $8)
       ON CONFLICT (idempotency_key) DO NOTHING
       RETURNING *`,
      [model.id, model.userId, model.title, model.message, model.type, model.category,
        JSON.stringify(model.data), idempotencyKey]
    );
    return this.mapRow(res.rows[0]);
  }

  /** Newest first, cursor-paginated: pass the createdAt of the last item you have as `before`. */
  async findByUserId(userId, { limit = 50, before = null, unreadOnly = false } = {}) {
    await this.ready;
    const params = [userId];
    let where = 'user_id = $1';
    if (unreadOnly) where += ' AND is_read = FALSE';
    if (before) {
      params.push(before);
      where += ` AND created_at < $${params.length}`;
    }
    params.push(Math.min(Math.max(parseInt(limit, 10) || 50, 1), 200));
    const res = await pool.query(
      `SELECT * FROM notifications WHERE ${where} ORDER BY created_at DESC LIMIT $${params.length}`,
      params
    );
    return res.rows.map((r) => this.mapRow(r));
  }

  async countUnread(userId) {
    await this.ready;
    const res = await pool.query(
      'SELECT COUNT(*)::int AS n FROM notifications WHERE user_id = $1 AND is_read = FALSE',
      [userId]
    );
    return res.rows[0].n;
  }

  async findAll() {
    await this.ready;
    const res = await pool.query('SELECT * FROM notifications ORDER BY created_at DESC LIMIT 500');
    return res.rows.map((r) => this.mapRow(r));
  }

  /** Only the owner can mark a notification as read (null when it is not theirs or not found). */
  async markAsRead(id, userId) {
    await this.ready;
    const res = await pool.query(
      'UPDATE notifications SET is_read = TRUE WHERE id = $1 AND user_id = $2 RETURNING *',
      [id, userId]
    );
    return this.mapRow(res.rows[0]);
  }

  /** Returns the ids that changed. */
  async markAllAsRead(userId) {
    await this.ready;
    const res = await pool.query(
      'UPDATE notifications SET is_read = TRUE WHERE user_id = $1 AND is_read = FALSE RETURNING id',
      [userId]
    );
    return res.rows.map((r) => r.id);
  }
}

export default new NotificationRepository();
