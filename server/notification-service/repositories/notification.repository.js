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
      isRead: r.is_read,
      createdAt: r.created_at ? new Date(r.created_at).toISOString() : new Date().toISOString()
    });
  }

  async create(data) {
    await this.ready;
    const model = new NotificationModel(data);
    const sql = `
      INSERT INTO notifications (id, user_id, title, message, type, is_read, created_at)
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING *;
    `;
    const values = [model.id, model.userId, model.title, model.message, model.type, model.isRead, model.createdAt];
    const res = await pool.query(sql, values);
    return this.mapRow(res.rows[0]);
  }

  async findByUserId(userId) {
    await this.ready;
    const res = await pool.query('SELECT * FROM notifications WHERE user_id = $1 ORDER BY created_at DESC', [userId]);
    return res.rows.map(r => this.mapRow(r));
  }

  async findAll() {
    await this.ready;
    const res = await pool.query('SELECT * FROM notifications ORDER BY created_at DESC');
    return res.rows.map(r => this.mapRow(r));
  }

  async markAsRead(id) {
    await this.ready;
    const res = await pool.query('UPDATE notifications SET is_read = TRUE WHERE id = $1 RETURNING *;', [id]);
    return this.mapRow(res.rows[0]);
  }
}

export default new NotificationRepository();
