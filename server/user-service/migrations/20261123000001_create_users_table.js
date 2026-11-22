/**
 * Knex Migration: Create users table
 * @param {import('knex').Knex} knex
 */
export async function up(knex) {
  const exists = await knex.schema.hasTable('users');
  if (!exists) {
    await knex.schema.createTable('users', (table) => {
      table.string('id', 64).primary();
      table.string('phone', 32).notNullable().unique();
      table.string('password', 255).notNullable();
      table.string('role', 16).notNullable().defaultTo('customer');
      table.string('name', 128).notNullable();
      table.timestamp('created_at', { useTz: true }).defaultTo(knex.fn.now());
      table.timestamp('updated_at', { useTz: true }).defaultTo(knex.fn.now());
    });
  }
}

/**
 * @param {import('knex').Knex} knex
 */
export async function down(knex) {
  await knex.schema.dropTableIfExists('users');
}
