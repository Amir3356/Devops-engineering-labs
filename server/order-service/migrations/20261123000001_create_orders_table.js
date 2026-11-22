/**
 * Knex Migration: Create orders table
 * @param {import('knex').Knex} knex
 */
export async function up(knex) {
  const exists = await knex.schema.hasTable('orders');
  if (!exists) {
    await knex.schema.createTable('orders', (table) => {
      table.string('id', 64).primary();
      table.string('customer_id', 64).notNullable().index();
      table.string('customer_phone', 32);
      table.jsonb('items').notNullable();
      table.decimal('total_amount', 10, 2).notNullable();
      table.jsonb('shipping_address');
      table.string('status', 32).notNullable().defaultTo('Pending').index();
      table.string('payment_id', 64);
      table.string('payment_status', 32).defaultTo('Pending');
      table.timestamp('created_at', { useTz: true }).defaultTo(knex.fn.now());
      table.timestamp('updated_at', { useTz: true }).defaultTo(knex.fn.now());
    });
  }
}

/**
 * @param {import('knex').Knex} knex
 */
export async function down(knex) {
  await knex.schema.dropTableIfExists('orders');
}
