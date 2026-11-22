/**
 * Knex Migration: Create payments table
 * @param {import('knex').Knex} knex
 */
export async function up(knex) {
  const exists = await knex.schema.hasTable('payments');
  if (!exists) {
    await knex.schema.createTable('payments', (table) => {
      table.string('id', 64).primary();
      table.string('order_id', 64).notNullable().index();
      table.string('customer_id', 64).notNullable().index();
      table.decimal('amount', 10, 2).notNullable();
      table.string('currency', 8).defaultTo('USD');
      table.string('payment_method', 32).notNullable().defaultTo('Card');
      table.string('status', 32).notNullable().defaultTo('Success');
      table.string('transaction_ref', 64).notNullable();
      table.timestamp('created_at', { useTz: true }).defaultTo(knex.fn.now());
    });
  }
}

/**
 * @param {import('knex').Knex} knex
 */
export async function down(knex) {
  await knex.schema.dropTableIfExists('payments');
}
