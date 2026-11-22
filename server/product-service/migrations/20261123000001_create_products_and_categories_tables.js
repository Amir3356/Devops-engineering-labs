/**
 * Knex Migration: Create categories and products tables
 * @param {import('knex').Knex} knex
 */
export async function up(knex) {
  const hasCat = await knex.schema.hasTable('categories');
  if (!hasCat) {
    await knex.schema.createTable('categories', (table) => {
      table.string('id', 64).primary();
      table.string('name', 128).notNullable();
      table.string('slug', 128).notNullable();
      table.text('description');
    });
  }

  const hasProd = await knex.schema.hasTable('products');
  if (!hasProd) {
    await knex.schema.createTable('products', (table) => {
      table.string('id', 64).primary();
      table.string('name', 255).notNullable();
      table.string('category', 128).notNullable().index();
      table.decimal('price', 10, 2).notNullable();
      table.integer('stock').notNullable().defaultTo(0);
      table.decimal('rating', 3, 1).defaultTo(5.0);
      table.text('description');
      table.text('image');
      table.timestamp('created_at', { useTz: true }).defaultTo(knex.fn.now());
      table.timestamp('updated_at', { useTz: true }).defaultTo(knex.fn.now());
    });
  }
}

/**
 * @param {import('knex').Knex} knex
 */
export async function down(knex) {
  await knex.schema.dropTableIfExists('products');
  await knex.schema.dropTableIfExists('categories');
}
