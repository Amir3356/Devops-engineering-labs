import { pick, toStr, toIsoDate } from './_fields';

export const ROLES = Object.freeze({ ADMIN: 'admin', CUSTOMER: 'customer' });

/**
 * @typedef {Object} User
 * @property {string} id
 * @property {string} name
 * @property {string} email
 * @property {string} phone
 * @property {'admin'|'customer'} role
 * @property {string|null} createdAt
 */

/** Build a UI User. Never carries password fields, whatever the API sends. */
export const createUser = (raw) => {
  if (!raw) return null;
  const role = toStr(pick(raw, 'role'), ROLES.CUSTOMER).toLowerCase();
  return {
    id: toStr(pick(raw, 'id', 'userId', 'user_id')),
    name: toStr(pick(raw, 'name', 'fullName', 'full_name')),
    email: toStr(pick(raw, 'email')),
    phone: toStr(pick(raw, 'phone')),
    role: role === ROLES.ADMIN ? ROLES.ADMIN : ROLES.CUSTOMER,
    createdAt: toIsoDate(pick(raw, 'createdAt', 'created_at')),
  };
};

export const isAdmin = (user) => user?.role === ROLES.ADMIN;

export const displayName = (user) => user?.name || user?.email || user?.phone || 'Guest';

export const initials = (user) =>
  displayName(user)
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join('');

/** Body for PUT /api/users/profile. */
export const profileFormToApi = (form) => ({
  name: toStr(form.name),
  email: toStr(form.email) || undefined,
  phone: toStr(form.phone) || undefined,
});
