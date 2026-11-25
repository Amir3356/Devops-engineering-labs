/**
 * Utility to parse human-readable duration strings (e.g., '24h', '7d', '60m', '3600s')
 * or numeric seconds into milliseconds for cookie maxAge and TTL calculations.
 *
 * @param {string|number} duration
 * @param {number} defaultMs
 * @returns {number} duration in milliseconds
 */
export function parseDurationToMs(duration, defaultMs = 24 * 60 * 60 * 1000) {
  if (typeof duration === 'number') {
    return duration * 1000;
  }
  if (!duration || typeof duration !== 'string') {
    return defaultMs;
  }

  const match = duration.trim().match(/^(\d+)\s*(ms|s|m|h|d|w|y)?$/i);
  if (!match) {
    return defaultMs;
  }

  const val = parseInt(match[1], 10);
  const unit = (match[2] || 's').toLowerCase();

  switch (unit) {
    case 'ms': return val;
    case 's': return val * 1000;
    case 'm': return val * 60 * 1000;
    case 'h': return val * 60 * 60 * 1000;
    case 'd': return val * 24 * 60 * 60 * 1000;
    case 'w': return val * 7 * 24 * 60 * 60 * 1000;
    case 'y': return val * 365 * 24 * 60 * 60 * 1000;
    default: return defaultMs;
  }
}
