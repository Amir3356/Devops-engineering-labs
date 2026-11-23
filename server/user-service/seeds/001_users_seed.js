import bcrypt from 'bcryptjs';

/**
 * Knex Seed: Insert Administrator profile
 * @param {import('knex').Knex} knex
 */
export async function seed(knex) {
  const salt = bcrypt.genSaltSync(10);
  const adminPassword = process.env.ADMIN_PASSWORD || 'AEHJSS36';
  const adminEmail = process.env.ADMIN_EMAIL || 'amirsiraj1995@gmail.com';
  const adminPhone = process.env.ADMIN_PHONE || '+251938617803';
  const adminName = process.env.ADMIN_NAME || 'System Administrator';
  const adminHash = bcrypt.hashSync(adminPassword, salt);

  await knex('users')
    .insert([
      { id: 'usr-admin-001', email: adminEmail, phone: adminPhone, password: adminHash, role: 'admin', name: adminName }
    ])
    .onConflict('id')
    .merge({
      email: knex.raw('EXCLUDED.email'),
      phone: knex.raw('EXCLUDED.phone'),
      password: knex.raw('EXCLUDED.password'),
      role: knex.raw('EXCLUDED.role'),
      name: knex.raw('EXCLUDED.name'),
      updated_at: knex.fn.now()
    });

  console.log(`[Knex Seed] Successfully seeded Admin credentials (${adminEmail} / ${adminPassword}) in user_db`);
}
