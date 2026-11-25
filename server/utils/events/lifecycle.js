import { disconnectProducer } from './kafka.js';

/**
 * Keep trying `start()` until it succeeds, so a service still boots (and serves HTTP)
 * while Kafka is restarting. The outbox keeps events safe in the meantime.
 */
export function startWithRetry(label, start, { initialDelayMs = 2000, maxDelayMs = 30000 } = {}) {
  let delay = initialDelayMs;
  const attempt = async () => {
    try {
      return await start();
    } catch (err) {
      console.error(`[${label}] Start failed, retrying in ${delay}ms:`, err.message);
      await new Promise((resolve) => setTimeout(resolve, delay));
      delay = Math.min(delay * 2, maxDelayMs);
      return attempt();
    }
  };
  return attempt();
}

const cleanups = [];
let installed = false;

/** Register cleanup to run on SIGTERM/SIGINT (docker stop, Ctrl+C). */
export function onShutdown(fn) {
  cleanups.push(fn);
  if (installed) return;
  installed = true;
  const shutdown = async (signal) => {
    console.log(`Received ${signal}, shutting down…`);
    for (const cleanup of cleanups.reverse()) {
      await Promise.resolve()
        .then(cleanup)
        .catch((err) => console.error('Shutdown step failed:', err.message));
    }
    await disconnectProducer();
    process.exit(0);
  };
  process.once('SIGTERM', () => shutdown('SIGTERM'));
  process.once('SIGINT', () => shutdown('SIGINT'));
}
