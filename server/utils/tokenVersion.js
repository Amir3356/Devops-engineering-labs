import { createClient } from 'redis';

let redisClient = null;
let isConnected = false;

/**
 * Returns the shared Redis client for token version management.
 */
export function getTokenVersionRedisClient() {
  if (redisClient) return redisClient;

  const url = (process.env.REDIS_URL || 'redis://localhost:6379').trim();

  redisClient = createClient({
    url,
    disableOfflineQueue: true,
    socket: {
      connectTimeout: 3000,
      reconnectStrategy: (retries) => Math.min(500 * (retries + 1), 3000)
    }
  });

  redisClient.on('ready', () => {
    isConnected = true;
  });

  redisClient.on('end', () => {
    isConnected = false;
  });

  redisClient.on('error', (err) => {
    isConnected = false;
    console.warn(`[TokenVersion] Redis client notice (${err.code || err.message})`);
  });

  redisClient.connect().catch(() => {});
  return redisClient;
}

/**
 * Gets the current active token version for a user from Redis.
 * If not set in Redis, defaults to 1 and initializes the key.
 *
 * @param {string} userId - User or account ID
 * @returns {Promise<number>} - Active token version (integer >= 1)
 */
export async function getActiveTokenVersion(userId) {
  if (!userId) return 1;

  try {
    const client = getTokenVersionRedisClient();
    if (!client.isOpen) await client.connect().catch(() => {});

    const key = `auth:token_version:${userId}`;
    const version = await client.get(key);

    if (version !== null) {
      return parseInt(version, 10);
    }

    // Default to version 1 on cold key
    await client.set(key, '1');
    return 1;
  } catch (err) {
    console.warn(`[TokenVersion] Failed to read version for user ${userId}:`, err.message);
    return 1;
  }
}

/**
 * Atomically increments the user's token version in Redis.
 * This immediately invalidates ALL active tokens across ALL devices for this user.
 *
 * @param {string} userId - User or account ID
 * @returns {Promise<number>} - The new active token version
 */
export async function revokeAllUserSessions(userId) {
  if (!userId) return null;

  try {
    const client = getTokenVersionRedisClient();
    if (!client.isOpen) await client.connect().catch(() => {});

    const key = `auth:token_version:${userId}`;
    const newVersion = await client.incr(key);

    // Also invalidate any cached user profiles for this user
    await client.del(`user:profile:${userId}`).catch(() => {});

    console.log(`[TokenVersion] Global logout: user ${userId} sessions revoked (new version: ${newVersion})`);
    return newVersion;
  } catch (err) {
    console.error(`[TokenVersion] Failed to revoke sessions for user ${userId}:`, err.message);
    throw err;
  }
}

/**
 * Validates whether a token's embedded version matches or exceeds the active version in Redis.
 * If tokenVersion is missing (legacy token) or smaller than the current Redis version, returns false.
 *
 * @param {string} userId - User or account ID
 * @param {number|string} tokenVersion - Token version embedded in JWT payload
 * @returns {Promise<boolean>} - True if session is valid; false if revoked or legacy
 */
export async function isTokenVersionValid(userId, tokenVersion) {
  if (!userId) return false;
  if (tokenVersion === undefined || tokenVersion === null) return false;

  const embeddedVersion = parseInt(tokenVersion, 10);
  if (Number.isNaN(embeddedVersion)) return false;

  const activeVersion = await getActiveTokenVersion(userId);
  return embeddedVersion >= activeVersion;
}

export default {
  getTokenVersionRedisClient,
  getActiveTokenVersion,
  revokeAllUserSessions,
  isTokenVersionValid
};
