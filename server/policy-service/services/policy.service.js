import policyRepository from '../repositories/policy.repository.js';
import PolicyModel, { POLICY_DEFINITIONS, getPolicyDefinition } from '../models/policy.model.js';
import { cached, invalidate } from '../../utils/cache.js';

const KEY_POLICY = (key) => `policies:${key}`; // namespaced 'policy:'
const POLICY_TTL = 300; // policies change rarely; writes clear the key anyway

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
    const json = await cached(KEY_POLICY(key), POLICY_TTL, async () =>
      ((await policyRepository.findByKey(key)) || PolicyModel.defaultsFor(key)).toJSON()
    );
    return new PolicyModel(json);
  }

  /** Partial update: unspecified settings keep their current values. */
  async updatePolicy(key, input, updatedBy) {
    if (!input || typeof input !== 'object' || Array.isArray(input)) {
      throw new Error('Request body must be an object of policy settings');
    }
    const definition = getPolicyDefinition(key);
    const current = await this.getPolicy(key);
    const settings = definition.validate(input, current.settings);
    const saved = await policyRepository.upsert(key, settings, updatedBy);
    await invalidate('policies'); // only after the commit
    return saved;
  }

  /** Reset to defaults by removing the stored row. */
  async resetPolicy(key) {
    getPolicyDefinition(key);
    await policyRepository.delete(key);
    await invalidate('policies'); // only after the commit
    return PolicyModel.defaultsFor(key);
  }
}

export default new PolicyService();
