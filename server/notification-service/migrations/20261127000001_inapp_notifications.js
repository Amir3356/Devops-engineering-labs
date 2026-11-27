/**
 * Knex Migration: in-app notifications created from Kafka events
 *   category / data        — what the notification is about (orders …) + link data (orderId)
 *   idempotency_key        — eventId:userId, UNIQUE → a redelivered event never creates a duplicate
 *   (user_id, is_read, created_at) index → fast "my notifications" + unread count
 * The repository applies the same statements at startup (IF NOT EXISTS), so this is safe to re-run.
 * @param {import('knex').Knex} knex
 */
export async function up(knex) {
  await knex.raw(`
    ALTER TABLE notifications
      ADD COLUMN IF NOT EXISTS category VARCHAR(32) DEFAULT 'general',
      ADD COLUMN IF NOT EXISTS data JSONB DEFAULT '{}'::jsonb,
      ADD COLUMN IF NOT EXISTS idempotency_key VARCHAR(160);
    CREATE UNIQUE INDEX IF NOT EXISTS notifications_idempotency_key_uq ON notifications (idempotency_key);
    CREATE INDEX IF NOT EXISTS notifications_user_unread_idx ON notifications (user_id, is_read, created_at DESC);
  `);
}

/**
 * @param {import('knex').Knex} knex
 */
export async function down(knex) {
  await knex.raw(`
    DROP INDEX IF EXISTS notifications_user_unread_idx;
    DROP INDEX IF EXISTS notifications_idempotency_key_uq;
    ALTER TABLE notifications DROP COLUMN IF EXISTS idempotency_key, DROP COLUMN IF EXISTS data, DROP COLUMN IF EXISTS category;
  `);
}
