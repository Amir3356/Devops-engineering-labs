/**
 * Knex Migration: selling prices on inventory rows
 * (unit price = total selling price ÷ batch quantity, set when a batch is stocked).
 * @param {import('knex').Knex} knex
 */
export async function up(knex) {
  const add = async (column, build) => {
    if (!(await knex.schema.hasColumn('inventory_stock', column))) {
      await knex.schema.alterTable('inventory_stock', build);
    }
  };
  await add('unit_selling_price', (t) => t.decimal('unit_selling_price', 10, 2));
  await add('total_selling_price', (t) => t.decimal('total_selling_price', 12, 2));
}

/**
 * @param {import('knex').Knex} knex
 */
export async function down(knex) {
  await knex.schema.alterTable('inventory_stock', (t) => {
    t.dropColumn('unit_selling_price');
    t.dropColumn('total_selling_price');
  });
}
