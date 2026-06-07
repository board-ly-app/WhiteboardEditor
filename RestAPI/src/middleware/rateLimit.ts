import rateLimit from 'express-rate-limit';

if (! process.env.RATE_LIMIT) {
  throw new Error('RATE_LIMIT not provided in process env');
}

const maxRequests = parseInt(process.env.RATE_LIMIT);

export const globalRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: maxRequests, // limit convert attempts per IP per window
  standardHeaders: true,
  legacyHeaders: false,
});// -- end globalRateLimiter
