/**
 * Knex Migration: Create accounts table
 * @param {import('knex').Knex} knex
 */
export async function up(knex) {
  const exists = await knex.schema.hasTable('accounts');
  if (!exists) {
    await knex.schema.createTable('accounts', (table) => {
      table.string('id', 64).primary();
      table.string('email', 128).unique().nullable();
      table.string('phone', 32).nullable();
      table.string('password', 255).notNullable();
      table.string('role', 16).notNullable().defaultTo('customer');
      table.string('name', 128).notNullable();
      table.timestamp('created_at', { useTz: true }).defaultTo(knex.fn.now());
      table.timestamp('updated_at', { useTz: true }).defaultTo(knex.fn.now());
    });
  } else {
    const hasEmail = await knex.schema.hasColumn('accounts', 'email');
    if (!hasEmail) {
      await knex.schema.table('accounts', (table) => {
        table.string('email', 128).unique().nullable();
      });
    }
  }
}

/**
 * @param {import('knex').Knex} knex
 */
export async function down(knex) {
  await knex.schema.dropTableIfExists('accounts');
}
