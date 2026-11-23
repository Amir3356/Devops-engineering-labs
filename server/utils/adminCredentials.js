/**
 * Administrator seed credentials, read only from the environment.
 *
 * There are deliberately NO fallback values here: credentials must never live
 * in source control. Set ADMIN_EMAIL and ADMIN_PASSWORD in server/.env (local)
 * or in the container environment (Docker). ADMIN_NAME is optional.
 */

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MIN_PASSWORD_LENGTH = 8;

export const ADMIN_ACCOUNT_ID = 'usr-admin-001';

/**
 * @returns {{ email: string, password: string, name: string }}
 * @throws {Error} when a required variable is missing or invalid
 */
export function getAdminCredentials() {
  const email = (process.env.ADMIN_EMAIL || '').trim();
  const password = process.env.ADMIN_PASSWORD || '';
  const name = (process.env.ADMIN_NAME || '').trim() || 'System Administrator';

  const missing = [];
  if (!email) missing.push('ADMIN_EMAIL');
  if (!password) missing.push('ADMIN_PASSWORD');
  if (missing.length) {
    throw new Error(
      `Missing required environment variable(s): ${missing.join(', ')}. ` +
      'Set them in server/.env (see server/.env.example) before seeding the administrator.'
    );
  }
  if (!EMAIL_PATTERN.test(email)) {
    throw new Error('ADMIN_EMAIL is not a valid email address.');
  }
  if (password.length < MIN_PASSWORD_LENGTH) {
    throw new Error(`ADMIN_PASSWORD must be at least ${MIN_PASSWORD_LENGTH} characters long.`);
  }

  return { email, password, name };
}
