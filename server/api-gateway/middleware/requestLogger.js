import crypto from 'crypto';

/**
 * Request Logger & Distributed Tracing Middleware
 * Generates an X-Request-ID if absent and logs incoming/outgoing HTTP transactions.
 */
export const requestLogger = (req, res, next) => {
  const requestId = req.headers['x-request-id'] || `req-${crypto.randomUUID().slice(0, 8)}`;
  req.headers['x-request-id'] = requestId;
  res.setHeader('X-Request-ID', requestId);

  const start = Date.now();

  res.on('finish', () => {
    const duration = Date.now() - start;
    const statusColor = res.statusCode >= 500 ? '\x1b[31m' : res.statusCode >= 400 ? '\x1b[33m' : '\x1b[32m';
    console.log(
      `[API GATEWAY] [${requestId}] ${req.method} ${req.originalUrl} -> ${statusColor}${res.statusCode}\x1b[0m (${duration}ms)`
    );
  });

  next();
};

export default requestLogger;
