import rateLimit from 'express-rate-limit';

export const globalRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit convert attempts per IP per window
  standardHeaders: true,
  legacyHeaders: false,
});// -- end globalRateLimiter
