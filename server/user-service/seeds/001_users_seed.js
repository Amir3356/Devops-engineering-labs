import bcrypt from 'bcryptjs';

/**
 * Knex Seed: Insert initial customer accounts & admin profile
 * @param {import('knex').Knex} knex
 */
export async function seed(knex) {
  const salt = bcrypt.genSaltSync(10);
  const adminHash = bcrypt.hashSync('AEHJSS36', salt);
  const customerHash = bcrypt.hashSync('CustomerPass2026', salt);

  await knex('users')
    .insert([
      { id: 'usr-admin-001', phone: '+251938617803', password: adminHash, role: 'admin', name: 'System Administrator' },
      { id: 'usr-seed-001', phone: '+251911223344', password: customerHash, role: 'customer', name: 'Abebe Bikila' },
      { id: 'usr-seed-002', phone: '+251922334455', password: customerHash, role: 'customer', name: 'Derartu Tulu' }
    ])
    .onConflict('id')
    .merge({
      phone: knex.raw('EXCLUDED.phone'),
      password: knex.raw('EXCLUDED.password'),
      role: knex.raw('EXCLUDED.role'),
      name: knex.raw('EXCLUDED.name'),
      updated_at: knex.fn.now()
    });

  console.log('[Knex Seed] Successfully seeded users (including Admin +251938617803) in user_db');
}
