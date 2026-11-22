/**
 * Knex Migration: Create inventory_stock table
 * @param {import('knex').Knex} knex
 */
export async function up(knex) {
  const exists = await knex.schema.hasTable('inventory_stock');
  if (!exists) {
    await knex.schema.createTable('inventory_stock', (table) => {
      table.string('product_id', 64).primary();
      table.string('product_name', 128).notNullable();
      table.integer('stock_quantity').notNullable().defaultTo(0).index();
      table.integer('low_stock_threshold').notNullable().defaultTo(5);
      table.timestamp('updated_at', { useTz: true }).defaultTo(knex.fn.now());
    });
  }
}

/**
 * @param {import('knex').Knex} knex
 */
export async function down(knex) {
  await knex.schema.dropTableIfExists('inventory_stock');
}
