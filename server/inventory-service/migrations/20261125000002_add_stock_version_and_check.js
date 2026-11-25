/**
 * Knex Migration: concurrency control for inventory_stock
 *  - version: optimistic concurrency control for absolute "set stock" edits
 *  - CHECK (stock_quantity >= 0): backstop so no code path can oversell
 * @param {import('knex').Knex} knex
 */
export async function up(knex) {
  await knex.raw(`
    ALTER TABLE inventory_stock ADD COLUMN IF NOT EXISTS version INT NOT NULL DEFAULT 0;
    DO $$ BEGIN
      IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'inventory_stock_quantity_non_negative') THEN
        ALTER TABLE inventory_stock ADD CONSTRAINT inventory_stock_quantity_non_negative
          CHECK (stock_quantity >= 0) NOT VALID;
      END IF;
    END $$;
  `);
}

/**
 * @param {import('knex').Knex} knex
 */
export async function down(knex) {
  await knex.raw(`
    ALTER TABLE inventory_stock DROP CONSTRAINT IF EXISTS inventory_stock_quantity_non_negative;
    ALTER TABLE inventory_stock DROP COLUMN IF EXISTS version;
  `);
}
