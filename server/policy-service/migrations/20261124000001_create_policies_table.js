/**
 * Knex Migration: Create policies table
 * @param {import('knex').Knex} knex
 */
export async function up(knex) {
  const exists = await knex.schema.hasTable('policies');
  if (!exists) {
    await knex.schema.createTable('policies', (table) => {
      table.string('key', 64).primary();
      table.jsonb('settings').notNullable().defaultTo('{}');
      table.string('updated_by', 64);
      table.timestamp('updated_at', { useTz: true }).defaultTo(knex.fn.now());
    });
  }
}

/**
 * @param {import('knex').Knex} knex
 */
export async function down(knex) {
  await knex.schema.dropTableIfExists('policies');
}
