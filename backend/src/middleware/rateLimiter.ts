// TODO: Run 'npm install' to install express-rate-limit
// import rateLimit from 'express-rate-limit';
import { Request, Response, NextFunction } from 'express';

// Temporary pass-through middleware until express-rate-limit is installed
const createPassThrough = () => (req: Request, res: Response, next: NextFunction) => next();

// General API rate limiter
export const apiLimiter = createPassThrough();
// TODO: Uncomment after npm install
/*
export const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Limit each IP to 100 requests per windowMs
  message: { error: 'Too many requests from this IP, please try again later.' },
  standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
  legacyHeaders: false, // Disable the `X-RateLimit-*` headers
  // Skip successful requests that don't modify data
  skipSuccessfulRequests: false,
  // Skip failed requests
  skipFailedRequests: false,
});
*/

// Stricter limiter for order creation
export const orderLimiter = createPassThrough();
// TODO: Uncomment after npm install
/*
export const orderLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 10, // Max 10 orders per minute per IP
  message: { error: 'Too many orders created, please slow down.' },
  standardHeaders: true,
  legacyHeaders: false,
});
*/

// Very strict limiter for authentication endpoints (if we add them)
export const authLimiter = createPassThrough();
// TODO: Uncomment after npm install
/*
export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // Only 5 failed login attempts per 15 minutes
  message: { error: 'Too many login attempts, please try again later.' },
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: true, // Don't count successful logins
});
*/

// Session creation limiter (prevent session spam)
export const sessionLimiter = createPassThrough();
// TODO: Uncomment after npm install
/*
export const sessionLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 5, // Max 5 sessions per minute per IP
  message: { error: 'Too many sessions created, please wait a moment.' },
  standardHeaders: true,
  legacyHeaders: false,
});
*/
