/**
 * Standard API response helper for uniform HTTP contracts across microservices.
 */

export const success = (res, data = null, message = 'Success', statusCode = 200) => {
  return res.status(statusCode).json({
    success: true,
    message,
    data,
    timestamp: new Date().toISOString()
  });
};

export const error = (res, message = 'Internal Server Error', statusCode = 500, details = null) => {
  return res.status(statusCode).json({
    success: false,
    message,
    details,
    timestamp: new Date().toISOString()
  });
};

export default {
  success,
  error
};
