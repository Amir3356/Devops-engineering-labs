/**
 * Knex Seed: Insert initial categories and catalog products
 * @param {import('knex').Knex} knex
 */
export async function seed(knex) {
  await knex('categories')
    .insert([
      { id: 'cat-audio', name: 'Audio', slug: 'audio', description: 'Headphones and speakers' },
      { id: 'cat-electronics', name: 'Electronics', slug: 'electronics', description: 'Monitors and peripherals' },
      { id: 'cat-wearables', name: 'Wearables', slug: 'wearables', description: 'Smartwatches and trackers' },
      { id: 'cat-accessories', name: 'Accessories', slug: 'accessories', description: 'Cables and adapters' }
    ])
    .onConflict('id')
    .ignore();

  await knex('products')
    .insert([
      {
        id: 'prod-001',
        name: 'Wireless Noise-Canceling Headphones',
        category: 'Audio',
        price: 249.99,
        stock: 45,
        rating: 4.8,
        description: 'Premium active noise-canceling wireless headphones with 30-hour battery life.',
        image: 'https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=600&auto=format&fit=crop&q=80'
      },
      {
        id: 'prod-002',
        name: 'Ergonomic Mechanical Keyboard',
        category: 'Electronics',
        price: 139.50,
        stock: 28,
        rating: 4.7,
        description: 'Split ergonomic layout with hot-swappable tactile mechanical switches.',
        image: 'https://images.unsplash.com/photo-1587829741301-dc798b83add3?w=600&auto=format&fit=crop&q=80'
      },
      {
        id: 'prod-003',
        name: 'Ultra-HD Smart Fitness Watch',
        category: 'Wearables',
        price: 199.00,
        stock: 14,
        rating: 4.6,
        description: 'Advanced biometric sensors with heart rate, SpO2, and GPS tracking.',
        image: 'https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=600&auto=format&fit=crop&q=80'
      }
    ])
    .onConflict('id')
    .ignore();

  console.log('[Knex Seed] Successfully seeded categories and products in product_db');
}
