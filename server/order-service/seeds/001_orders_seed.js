/**
 * Knex Seed: Insert initial demo order
 * @param {import('knex').Knex} knex
 */
export async function seed(knex) {
  await knex('orders')
    .insert([
      {
        id: 'ord-seed-001',
        customer_id: 'usr-admin-001',
        customer_phone: '+251938617803',
        items: JSON.stringify([
          {
            product_id: 'prod-001',
            name: 'Wireless Noise-Canceling Headphones',
            quantity: 1,
            unit_price: 249.99,
            total_price: 249.99
          }
        ]),
        total_amount: 249.99,
        shipping_address: JSON.stringify({
          city: 'Addis Ababa',
          country: 'Ethiopia',
          address_line: 'Bole Medhanealem'
        }),
        status: 'Delivered',
        payment_id: 'pay-seed-001',
        payment_status: 'Paid'
      }
    ])
    .onConflict('id')
    .ignore();

  console.log('[Knex Seed] Successfully seeded demo order in order_db');
}
