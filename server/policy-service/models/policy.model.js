/**
 * Policy Model
 * A policy is a named set of admin-controlled business rules, stored as JSON settings.
 * Each policy key has a definition: its defaults and how its settings are validated.
 */

const toBool = (value, fallback) => (typeof value === 'boolean' ? value : fallback);

const toBoundedInt = (value, { field, min, max }) => {
  const n = typeof value === 'number' ? value : parseInt(value, 10);
  if (!Number.isInteger(n) || n < min || n > max) {
    throw new Error(`${field} must be a whole number between ${min} and ${max}`);
  }
  return n;
};

export const POLICY_DEFINITIONS = Object.freeze({
  'inventory-alerts': {
    name: 'Inventory Alert Policy',
    description: 'When products are flagged as low stock or expiring soon.',
    defaults: {
      lowStockThreshold: 10,
      expiryWarningDays: 30,
      enableLowStockAlerts: true,
      enableExpiryAlerts: true,
      highlightOutOfStock: true
    },
    /** Merge partial input over current settings and validate the result. */
    validate(input = {}, current) {
      const merged = { ...current, ...input };
      return {
        lowStockThreshold: toBoundedInt(merged.lowStockThreshold, { field: 'lowStockThreshold', min: 1, max: 100000 }),
        expiryWarningDays: toBoundedInt(merged.expiryWarningDays, { field: 'expiryWarningDays', min: 1, max: 3650 }),
        enableLowStockAlerts: toBool(merged.enableLowStockAlerts, current.enableLowStockAlerts),
        enableExpiryAlerts: toBool(merged.enableExpiryAlerts, current.enableExpiryAlerts),
        highlightOutOfStock: toBool(merged.highlightOutOfStock, current.highlightOutOfStock)
      };
    }
  }
});

export const getPolicyDefinition = (key) => {
  const definition = POLICY_DEFINITIONS[key];
  if (!definition) {
    const err = new Error(`Unknown policy "${key}". Known policies: ${Object.keys(POLICY_DEFINITIONS).join(', ')}`);
    err.status = 404;
    throw err;
  }
  return definition;
};

export default class PolicyModel {
  constructor({ key, settings, updatedBy, updatedAt, isDefault = false }) {
    const definition = getPolicyDefinition(key);
    this.key = key;
    this.name = definition.name;
    this.description = definition.description;
    this.settings = { ...definition.defaults, ...(settings || {}) };
    this.updatedBy = updatedBy || null;
    this.updatedAt = updatedAt || null;
    this.isDefault = isDefault;
  }

  static defaultsFor(key) {
    return new PolicyModel({ key, settings: getPolicyDefinition(key).defaults, isDefault: true });
  }

  toJSON() {
    return {
      key: this.key,
      name: this.name,
      description: this.description,
      settings: this.settings,
      isDefault: this.isDefault,
      updatedBy: this.updatedBy,
      updatedAt: this.updatedAt
    };
  }
}
