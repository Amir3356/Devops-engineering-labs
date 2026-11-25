import { INBOX_DDL } from '../../utils/events/schema.js';

/**
 * Knex Migration: inbox of processed Kafka events (makes the receipt consumer idempotent)
 * @param {import('knex').Knex} knex
 */
export async function up(knex) {
  await knex.raw(INBOX_DDL);
}

/**
 * @param {import('knex').Knex} knex
 */
export async function down(knex) {
  await knex.schema.dropTableIfExists('inbox');
}
