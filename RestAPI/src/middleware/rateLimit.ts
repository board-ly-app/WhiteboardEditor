import rateLimit from 'express-rate-limit';

const {
  GLOBAL_RATE_LIMIT,
  GLOBAL_RATE_LIMIT_WINDOW_SECS,
  SIGNUP_RATE_LIMIT,
  SIGNUP_RATE_LIMIT_WINDOW_SECS,
  AUTH_RATE_LIMIT,
  AUTH_RATE_LIMIT_WINDOW_SECS,
} = process.env;

if (! GLOBAL_RATE_LIMIT) throw new Error('Env var GLOBAL_RATE_LIMIT not provided');
if (! GLOBAL_RATE_LIMIT_WINDOW_SECS) throw new Error('Env var GLOBAL_RATE_LIMIT_WINDOW_SECS not provided');
if (! SIGNUP_RATE_LIMIT) throw new Error('Env var SIGNUP_RATE_LIMIT not provided');
if (! SIGNUP_RATE_LIMIT_WINDOW_SECS) throw new Error('Env var SIGNUP_RATE_LIMIT_WINDOW_SECS not provided');
if (! AUTH_RATE_LIMIT) throw new Error('Env var AUTH_RATE_LIMIT not provided');
if (! AUTH_RATE_LIMIT_WINDOW_SECS) throw new Error('Env var AUTH_RATE_LIMIT_WINDOW_SECS not provided');

const globalRateLimit = parseInt(GLOBAL_RATE_LIMIT);
const globalRateLimitWindowSecs = parseInt(GLOBAL_RATE_LIMIT_WINDOW_SECS);
const signupRateLimit = parseInt(SIGNUP_RATE_LIMIT);
const signupRateLimitWindowSecs = parseInt(SIGNUP_RATE_LIMIT_WINDOW_SECS);
const authRateLimit = parseInt(AUTH_RATE_LIMIT);
const authRateLimitWindowSecs = parseInt(AUTH_RATE_LIMIT_WINDOW_SECS);

if (Number.isNaN(globalRateLimit)) throw new Error("GLOBAL_RATE_LIMIT is not a valid number");
if (Number.isNaN(signupRateLimit)) throw new Error("SIGNUP_RATE_LIMIT is not a valid number");
if (Number.isNaN(authRateLimit)) throw new Error("AUTH_RATE_LIMIT is not a valid number");

if (Number.isNaN(globalRateLimitWindowSecs)) {
  throw new Error("GLOBAL_RATE_LIMIT_WINDOW_SECS is not a valid number");
}
if (Number.isNaN(signupRateLimitWindowSecs)) {
  throw new Error("SIGNUP_RATE_LIMIT_WINDOW_SECS is not a valid number");
}
if (Number.isNaN(authRateLimitWindowSecs)) {
  throw new Error("AUTH_RATE_LIMIT_WINDOW_SECS is not a valid number");
}

export const globalRateLimiter = rateLimit({
  windowMs: globalRateLimitWindowSecs * 1000,
  max: globalRateLimit,
  standardHeaders: true,
  legacyHeaders: false,
});// -- end globalRateLimiter

// === signupRateLimiter =======================================================
//
// Account creation endpoints are uniquely vulnerable to exploitation; best to
// give them an even more restricted limit.
//
// =============================================================================
export const signupRateLimiter = rateLimit({
  windowMs: signupRateLimitWindowSecs * 1000,
  max: signupRateLimit,
  standardHeaders: true,
  legacyHeaders: false,
});// -- end signupRateLimiter

// === authRateLimiter =========================================================
//
// Account creation endpoints are uniquely vulnerable to exploitation; best to
// give them an even more restricted limit.
//
// =============================================================================
export const authRateLimiter = rateLimit({
  windowMs: authRateLimitWindowSecs * 1000,
  max: authRateLimit,
  standardHeaders: true,
  legacyHeaders: false,
});// -- end authRateLimiter
