/**
 * Knex Migration: Create sales table
 * Mirrors the schema SaleRepository.initSchema() creates at runtime.
 * @param {import('knex').Knex} knex
 */
export async function up(knex) {
  const exists = await knex.schema.hasTable('sales');
  if (!exists) {
    await knex.schema.createTable('sales', (table) => {
      table.string('id', 64).primary();
      table.string('sale_id', 64).notNullable();
      table.string('batch_id', 64);
      table.string('product_id', 64);
      table.string('product_name', 128).notNullable();
      table.string('category', 64);
      table.integer('quantity').notNullable().defaultTo(1);
      table.decimal('unit_price', 10, 2).notNullable().defaultTo(0);
      table.decimal('total_amount', 10, 2).notNullable().defaultTo(0);
      table.string('customer_name', 128);
      table.string('customer_email', 128);
      table.string('customer_phone', 64);
      table.string('payment_status', 32).defaultTo('Paid');
      table.string('fulfillment_status', 32).defaultTo('Delivered');
      table.timestamp('created_at', { useTz: true }).defaultTo(knex.fn.now());
    });
  }
}

/**
 * @param {import('knex').Knex} knex
 */
export async function down(knex) {
  await knex.schema.dropTableIfExists('sales');
}
