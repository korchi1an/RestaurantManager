import { Request, Response, NextFunction } from 'express';
import logger from '../utils/logger';

// Custom error class
export class AppError extends Error {
  constructor(
    public message: string,
    public statusCode: number = 500,
    public isOperational: boolean = true
  ) {
    super(message);
    Object.setPrototypeOf(this, AppError.prototype);
    Error.captureStackTrace(this, this.constructor);
  }
}

// Error handler middleware
export const errorHandler = (
  err: Error | AppError,
  req: Request,
  res: Response,
  next: NextFunction
) => {
  logger.error('ERROR_HANDLER - Error caught', {
    message: err.message,
    url: req.url,
    method: req.method,
    statusCode: err instanceof AppError ? err.statusCode : 500,
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
  });

  // Handle known AppError instances
  if (err instanceof AppError) {
    return res.status(err.statusCode).json({
      error: err.message,
      ...(process.env.NODE_ENV === 'development' && { 
        stack: err.stack,
        details: err 
      })
    });
  }

  // Handle validation errors (from express-validator or similar)
  if (err.name === 'ValidationError') {
    return res.status(400).json({
      error: 'Validation error',
      details: err.message,
      ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
    });
  }

  // Handle PostgreSQL database errors
  if ((err as any).code) {
    const pgError = err as any;
    // Common PostgreSQL error codes
    switch (pgError.code) {
      case '23505': // unique_violation
        return res.status(409).json({
          error: 'Duplicate entry - this record already exists',
          ...(process.env.NODE_ENV === 'development' && { detail: pgError.detail })
        });
      case '23503': // foreign_key_violation
        return res.status(400).json({
          error: 'Invalid reference - related record does not exist',
          ...(process.env.NODE_ENV === 'development' && { detail: pgError.detail })
        });
      case '23502': // not_null_violation
        return res.status(400).json({
          error: 'Missing required field',
          ...(process.env.NODE_ENV === 'development' && { detail: pgError.detail })
        });
      case 'ECONNREFUSED':
      case '08006': // connection_failure
        return res.status(503).json({
          error: 'Database temporarily unavailable',
          ...(process.env.NODE_ENV === 'development' && { message: pgError.message })
        });
      default:
        return res.status(500).json({
          error: 'Database error occurred',
          ...(process.env.NODE_ENV === 'development' && { 
            message: pgError.message,
            code: pgError.code
          })
        });
    }
  }

  // Handle JWT errors
  if (err.name === 'JsonWebTokenError') {
    return res.status(401).json({
      error: 'Invalid authentication token'
    });
  }

  if (err.name === 'TokenExpiredError') {
    return res.status(401).json({
      error: 'Authentication token expired'
    });
  }

  // Unexpected errors - don't leak details in production
  return res.status(500).json({
    error: 'Internal server error',
    ...(process.env.NODE_ENV === 'development' && { 
      message: err.message,
      stack: err.stack 
    })
  });
};

// Async handler wrapper to catch async errors
export const asyncHandler = (fn: Function) => {
  return (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
};
