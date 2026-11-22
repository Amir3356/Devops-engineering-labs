/**
 * Knex Seed: Insert initial inventory stock
 * @param {import('knex').Knex} knex
 */
export async function seed(knex) {
  await knex('inventory_stock')
    .insert([
      { product_id: 'prod-001', product_name: 'Wireless Noise-Canceling Headphones', stock_quantity: 45, low_stock_threshold: 5 },
      { product_id: 'prod-002', product_name: 'Ergonomic Mechanical Keyboard', stock_quantity: 28, low_stock_threshold: 5 },
      { product_id: 'prod-003', product_name: 'Ultra-HD Smart Fitness Watch', stock_quantity: 14, low_stock_threshold: 5 }
    ])
    .onConflict('product_id')
    .ignore();

  console.log('[Knex Seed] Successfully seeded inventory stock in inventory_db');
}
