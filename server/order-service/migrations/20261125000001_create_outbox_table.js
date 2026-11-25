import { OUTBOX_DDL } from '../../utils/events/schema.js';

/**
 * Knex Migration: transactional outbox for order events (published to order.events)
 * @param {import('knex').Knex} knex
 */
export async function up(knex) {
  await knex.raw(OUTBOX_DDL);
}

/**
 * @param {import('knex').Knex} knex
 */
export async function down(knex) {
  await knex.schema.dropTableIfExists('outbox');
}
