import bcrypt from 'bcryptjs';

/**
 * Knex Seed: Insert or update default Administrator credentials
 * @param {import('knex').Knex} knex
 */
export async function seed(knex) {
  const salt = bcrypt.genSaltSync(10);
  const adminPassword = process.env.ADMIN_PASSWORD || 'AEHJSS36';
  const adminEmail = process.env.ADMIN_EMAIL || 'amirsiraj1995@gmail.com';
  const adminPhone = process.env.ADMIN_PHONE || '+251938617803';
  const adminName = process.env.ADMIN_NAME || 'System Administrator';
  const hashedPassword = bcrypt.hashSync(adminPassword, salt);

  await knex('accounts')
    .insert({
      id: 'usr-admin-001',
      email: adminEmail,
      phone: adminPhone,
      password: hashedPassword,
      role: 'admin',
      name: adminName,
      updated_at: knex.fn.now()
    })
    .onConflict('id')
    .merge({
      email: adminEmail,
      phone: adminPhone,
      password: hashedPassword,
      role: 'admin',
      name: adminName,
      updated_at: knex.fn.now()
    });

  console.log(`[Knex Seed] Successfully seeded Admin credentials (${adminEmail} / ${adminPassword}) in auth_db`);
}
