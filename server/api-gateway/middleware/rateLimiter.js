import { error } from '../../utils/response.js';

/**
 * Sliding Window In-Memory Rate Limiter
 * Protects downstream microservices from DDoS and brute-force spikes.
 */
class RateLimiter {
  constructor(windowMs = 60 * 1000, maxRequests = 150) {
    this.windowMs = windowMs;
    this.maxRequests = maxRequests;
    this.clients = new Map();

    // Clean up stale client records every 5 minutes
    setInterval(() => {
      const now = Date.now();
      for (const [key, record] of this.clients.entries()) {
        if (now - record.startTime > this.windowMs) {
          this.clients.delete(key);
        }
      }
    }, 5 * 60 * 1000).unref();
  }

  middleware() {
    return (req, res, next) => {
      // Exclude health check from rate limiting
      if (req.path === '/health') {
        return next();
      }

      const clientIp = req.ip || req.headers['x-forwarded-for'] || req.socket.remoteAddress || 'unknown';
      const now = Date.now();

      let record = this.clients.get(clientIp);

      if (!record || now - record.startTime > this.windowMs) {
        record = {
          startTime: now,
          count: 1
        };
        this.clients.set(clientIp, record);
      } else {
        record.count++;
      }

      const remaining = Math.max(0, this.maxRequests - record.count);
      const resetTime = Math.ceil((record.startTime + this.windowMs - now) / 1000);

      res.setHeader('X-RateLimit-Limit', this.maxRequests);
      res.setHeader('X-RateLimit-Remaining', remaining);
      res.setHeader('X-RateLimit-Reset', resetTime);

      if (record.count > this.maxRequests) {
        return error(
          res,
          'Too many requests: Rate limit exceeded. Please try again shortly.',
          429,
          { retryAfterSeconds: resetTime }
        );
      }

      next();
    };
  }
}

export const rateLimiter = new RateLimiter().middleware();
export default rateLimiter;
