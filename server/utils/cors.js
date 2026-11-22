import cors from 'cors';

/**
 * Standard CORS configuration for Express.js microservices & API Gateway
 * Utilizing the official 'cors' npm package library.
 */
export const corsOptions = {
  origin: '*',
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: [
    'Content-Type',
    'Authorization',
    'x-user-id',
    'x-user-phone',
    'x-user-email',
    'x-user-role'
  ],
  exposedHeaders: ['x-user-id', 'x-user-role'],
  credentials: true,
  optionsSuccessStatus: 200
};

export const corsMiddleware = cors(corsOptions);

export default corsMiddleware;
