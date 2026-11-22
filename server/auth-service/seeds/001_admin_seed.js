import bcrypt from 'bcryptjs';

/**
 * Knex Seed: Insert or update default Administrator credentials
 * @param {import('knex').Knex} knex
 */
export async function seed(knex) {
  const salt = bcrypt.genSaltSync(10);
  const hashedPassword = bcrypt.hashSync('AEHJSS36', salt);

  await knex('accounts')
    .insert({
      id: 'usr-admin-001',
      phone: '+251938617803',
      password: hashedPassword,
      role: 'admin',
      name: 'System Administrator',
      updated_at: knex.fn.now()
    })
    .onConflict('id')
    .merge({
      phone: '+251938617803',
      password: hashedPassword,
      role: 'admin',
      name: 'System Administrator',
      updated_at: knex.fn.now()
    });

  console.log('[Knex Seed] Successfully seeded Admin credentials (+251938617803) in auth_db');
}
