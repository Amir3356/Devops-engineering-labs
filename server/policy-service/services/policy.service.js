import policyRepository from '../repositories/policy.repository.js';
import PolicyModel, { POLICY_DEFINITIONS, getPolicyDefinition } from '../models/policy.model.js';

/**
 * Policy business logic.
 * A policy with no stored row is served with its defaults.
 */
class PolicyService {
  async getAllPolicies() {
    const stored = new Map((await policyRepository.findAll()).map((p) => [p.key, p]));
    return Object.keys(POLICY_DEFINITIONS).map((key) => stored.get(key) || PolicyModel.defaultsFor(key));
  }

  async getPolicy(key) {
    getPolicyDefinition(key); // 404 for unknown keys
    return (await policyRepository.findByKey(key)) || PolicyModel.defaultsFor(key);
  }

  /** Partial update: unspecified settings keep their current values. */
  async updatePolicy(key, input, updatedBy) {
    if (!input || typeof input !== 'object' || Array.isArray(input)) {
      throw new Error('Request body must be an object of policy settings');
    }
    const definition = getPolicyDefinition(key);
    const current = await this.getPolicy(key);
    const settings = definition.validate(input, current.settings);
    return policyRepository.upsert(key, settings, updatedBy);
  }

  /** Reset to defaults by removing the stored row. */
  async resetPolicy(key) {
    getPolicyDefinition(key);
    await policyRepository.delete(key);
    return PolicyModel.defaultsFor(key);
  }
}

export default new PolicyService();
