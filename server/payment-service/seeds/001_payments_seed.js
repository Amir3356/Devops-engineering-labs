/**
 * Knex Seed: Insert initial demo payment
 * @param {import('knex').Knex} knex
 */
export async function seed(knex) {
  await knex('payments')
    .insert([
      {
        id: 'pay-seed-001',
        order_id: 'ord-seed-001',
        customer_id: 'usr-admin-001',
        amount: 249.99,
        currency: 'USD',
        payment_method: 'Card',
        status: 'Success',
        transaction_ref: 'TXN-SEED-001-2026'
      }
    ])
    .onConflict('id')
    .ignore();

  console.log('[Knex Seed] Successfully seeded demo payment in payment_db');
}
