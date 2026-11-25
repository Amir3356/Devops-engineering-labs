import { OUTBOX_DDL, INBOX_DDL } from '../../utils/events/schema.js';

/**
 * Knex Migration: outbox (saga replies → inventory.events) and inbox (processed order events)
 * @param {import('knex').Knex} knex
 */
export async function up(knex) {
  await knex.raw(OUTBOX_DDL);
  await knex.raw(INBOX_DDL);
}

/**
 * @param {import('knex').Knex} knex
 */
export async function down(knex) {
  await knex.schema.dropTableIfExists('inbox');
  await knex.schema.dropTableIfExists('outbox');
}
