/**
 * Knex Migration: idempotent checkout
 * One order per (customer, client-generated checkout id); a duplicate submit returns that order.
 * @param {import('knex').Knex} knex
 */
export async function up(knex) {
  await knex.raw(`
    ALTER TABLE orders ADD COLUMN IF NOT EXISTS idempotency_key VARCHAR(64);
    CREATE UNIQUE INDEX IF NOT EXISTS orders_customer_idempotency_key_uidx
      ON orders (customer_id, idempotency_key) WHERE idempotency_key IS NOT NULL;
  `);
}

/**
 * @param {import('knex').Knex} knex
 */
export async function down(knex) {
  await knex.raw(`
    DROP INDEX IF EXISTS orders_customer_idempotency_key_uidx;
    ALTER TABLE orders DROP COLUMN IF EXISTS idempotency_key;
  `);
}
