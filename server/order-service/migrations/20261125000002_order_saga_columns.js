/**
 * Knex Migration: order saga columns
 *  - customer_email / customer_name: receipt contact carried on OrderConfirmed
 *  - status_reason: why a stock reservation was rejected
 * @param {import('knex').Knex} knex
 */
export async function up(knex) {
  await knex.raw(`
    ALTER TABLE orders ADD COLUMN IF NOT EXISTS customer_email VARCHAR(255);
    ALTER TABLE orders ADD COLUMN IF NOT EXISTS customer_name VARCHAR(128);
    ALTER TABLE orders ADD COLUMN IF NOT EXISTS status_reason TEXT;
  `);
}

/**
 * @param {import('knex').Knex} knex
 */
export async function down(knex) {
  await knex.schema.alterTable('orders', (table) => {
    table.dropColumn('customer_email');
    table.dropColumn('customer_name');
    table.dropColumn('status_reason');
  });
}
