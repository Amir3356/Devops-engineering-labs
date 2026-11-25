/**
 * Knex Migration: Create purchases table
 * Mirrors the schema PurchaseRepository.initSchema() creates at runtime.
 * @param {import('knex').Knex} knex
 */
export async function up(knex) {
  const exists = await knex.schema.hasTable('purchases');
  if (!exists) {
    await knex.schema.createTable('purchases', (table) => {
      table.string('id', 64).primary();
      table.string('batch_id', 64).notNullable();
      table.string('product_name', 128).notNullable();
      table.string('category', 64).notNullable();
      table.integer('quantity').notNullable().defaultTo(1);
      table.string('supplier', 128);
      table.decimal('unit_cost', 10, 2).defaultTo(0);
      table.decimal('total_cost', 10, 2).defaultTo(0);
      table.string('status', 32).defaultTo('Paid');
      table.timestamp('created_at', { useTz: true }).defaultTo(knex.fn.now());
    });
  }
}

/**
 * @param {import('knex').Knex} knex
 */
export async function down(knex) {
  await knex.schema.dropTableIfExists('purchases');
}
