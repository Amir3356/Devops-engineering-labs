import bcrypt from 'bcryptjs';
import { getAdminCredentials, ADMIN_ACCOUNT_ID } from '../../utils/adminCredentials.js';

/**
 * Knex Seed: Insert or update the default Administrator account.
 * Credentials come only from the environment (ADMIN_EMAIL, ADMIN_PASSWORD, ADMIN_NAME).
 * @param {import('knex').Knex} knex
 */
export async function seed(knex) {
  const { email, password, name } = getAdminCredentials();
  const hashedPassword = await bcrypt.hash(password, 10);

  const account = {
    email,
     // administrators are not given a phone number
    password: hashedPassword,
    role: 'admin',
    name,
    updated_at: knex.fn.now()
  };

  await knex('accounts')
    .insert({ id: ADMIN_ACCOUNT_ID, ...account })
    .onConflict('id')
    .merge(account);

  console.log(`[Knex Seed] Administrator account seeded in auth_db (${email}).`);
}
