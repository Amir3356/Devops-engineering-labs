/**
 * Knex Migration: Create notifications table
 * @param {import('knex').Knex} knex
 */
export async function up(knex) {
  const exists = await knex.schema.hasTable('notifications');
  if (!exists) {
    await knex.schema.createTable('notifications', (table) => {
      table.string('id', 64).primary();
      table.string('user_id', 64).notNullable().index();
      table.string('title', 128).notNullable();
      table.text('message').notNullable();
      table.string('type', 32).defaultTo('info');
      table.boolean('is_read').defaultTo(false);
      table.timestamp('created_at', { useTz: true }).defaultTo(knex.fn.now());
    });
  }
}

/**
 * @param {import('knex').Knex} knex
 */
export async function down(knex) {
  await knex.schema.dropTableIfExists('notifications');
}
