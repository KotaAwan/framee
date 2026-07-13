import { logger } from '../../utils/logger.js';
import { FrameeError } from '../../utils/errors.js';

/**
 * Global Error Handler middleware for Express.
 */
export const errorHandler = (err, req, res, next) => {
  // Log the error
  logger.error(`[${req.method}] ${req.originalUrl} - ${err.message}`, { stack: err.stack });

  // Handle known Framee errors
  if (err instanceof FrameeError) {
    return res.status(err.statusCode).json({
      success: false,
      error: {
        code: err.code,
        message: err.message,
        details: err.details
      }
    });
  }

  // Handle generic / unhandled errors
  return res.status(500).json({
    success: false,
    error: {
      code: 'INTERNAL_SERVER_ERROR',
      message: process.env.APP_ENV === 'development' ? err.message : 'An internal server error occurred.'
    }
  });
};
