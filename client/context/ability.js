import { AbilityBuilder, createMongoAbility } from '@casl/ability';

/**
 * Defines CASL RBAC client abilities based on user role.
 * @param {object|null} user - The logged in user from AuthContext
 * @returns {MongoAbility}
 */
export function defineAbilityFor(user) {
  const { can, build } = new AbilityBuilder(createMongoAbility);

  if (user?.role === 'admin') {
    // Administrator has full permissions
    can('manage', 'all');
  } else if (user?.role === 'customer') {
    // Customer permissions
    can('read', 'Product');
    can('manage', 'Cart');
    can('read', 'Order');
    can('create', 'Order');
    can('cancel', 'Order');
    can('manage', 'Profile');
    can('read', 'CustomerDashboard');
    can('read', 'Notification');
    can('manage', 'Notification');
    can('read', 'Payment');
  } else {
    // Guest permissions (default-deny for all else)
    can('read', 'Product');
    can('manage', 'Cart');
    can('create', 'Account');
  }

  return build();
}
