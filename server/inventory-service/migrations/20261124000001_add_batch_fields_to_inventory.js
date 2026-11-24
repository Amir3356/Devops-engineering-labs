/**
 * Knex Migration: record batch details on inventory rows
 * (batch id, category, expiry date) when stock is added from a purchase batch.
 * @param {import('knex').Knex} knex
 */
export async function up(knex) {
  const add = async (column, build) => {
    if (!(await knex.schema.hasColumn('inventory_stock', column))) {
      await knex.schema.alterTable('inventory_stock', build);
    }
  };
  await add('batch_id', (t) => t.string('batch_id', 64));
  await add('category', (t) => t.string('category', 128));
  await add('expires_at', (t) => t.date('expires_at'));
}

/**
 * @param {import('knex').Knex} knex
 */
export async function down(knex) {
  await knex.schema.alterTable('inventory_stock', (t) => {
    t.dropColumn('batch_id');
    t.dropColumn('category');
    t.dropColumn('expires_at');
  });
}
