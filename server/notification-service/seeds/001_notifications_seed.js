/**
 * Knex Seed: Insert initial welcome notification
 * @param {import('knex').Knex} knex
 */
export async function seed(knex) {
  await knex('notifications')
    .insert([
      {
        id: 'notif-seed-001',
        user_id: 'usr-admin-001',
        title: 'Welcome to Microservices E-Commerce',
        message: 'Your system and multi-database services are fully configured and connected.',
        type: 'system',
        is_read: false
      }
    ])
    .onConflict('id')
    .ignore();

  console.log('[Knex Seed] Successfully seeded welcome notification in notification_db');
}
