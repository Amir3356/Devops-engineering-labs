import { AbilityBuilder, createMongoAbility } from '@casl/ability';

/**
 * Defines CASL RBAC permissions for a given user.
 * @param {object} user - The user object from JWT (containing role and id).
 * @returns {MongoAbility}
 */
export function defineAbilityForUser(user) {
  const { can, build } = new AbilityBuilder(createMongoAbility);

  if (user && user.role === 'admin') {
    // Administrator has full management permissions
    can('manage', 'all');
  } else if (user && user.role === 'customer') {
    // Authenticated Customer permissions
    can('read', 'Product');
    can('read', 'Category');
    can('create', 'Order');
    can('read', 'Order', { customer_id: user.id });
    can('cancel', 'Order', { customer_id: user.id });
    can('create', 'Payment');
    can('read', 'Payment', { customer_id: user.id });
    can('manage', 'Profile', { id: user.id });
    can('read', 'Notification', { user_id: user.id });
  } else {
    // Unauthenticated Guest permissions (default-deny for all else)
    can('read', 'Product');
    can('read', 'Category');
    can('create', 'Account');
    can('read', 'Stock');
  }

  return build();
}

/**
 * Express middleware to enforce CASL ability on endpoints.
 * Consumes decoded req.user or downstream headers forwarded by API Gateway.
 * @param {string} action - 'read' | 'create' | 'update' | 'delete' | 'manage' | 'cancel'
 * @param {string} subject - Resource name e.g. 'Product', 'Order', 'Category', 'Profile'
 */
export function requireAbility(action, subject) {
  return (req, res, next) => {
    const user = req.user || (req.headers && req.headers['x-user-role'] ? {
      id: req.headers['x-user-id'],
      role: req.headers['x-user-role'],
      phone: req.headers['x-user-phone']
    } : null);

    const ability = defineAbilityForUser(user);

    if (!ability.can(action, subject)) {
      return res.status(403).json({
        success: false,
        message: `Forbidden: CASL RBAC check denied permission to '${action}' on '${subject}'.`,
        timestamp: new Date().toISOString()
      });
    }

    req.ability = ability;
    next();
  };
}

export default {
  defineAbilityForUser,
  requireAbility
};
