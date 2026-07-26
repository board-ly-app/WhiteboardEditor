// === antiCsrfService.ts ======================================================
//
// Utilities for securing authenticated requests using the Double Submit Cookie
// Pattern. Implemented as a wrapper around the csrf-csrf package.
//
// =============================================================================

import {
  type Request,
} from 'express';

import {
  doubleCsrf,
} from 'csrf-csrf';

import {
  v4 as uuidv4,
  validate as validateUuid,
} from 'uuid';

import {
  IS_PRODUCTION,
  SESSION_ID_COOKIE_ID,
  SESSION_TOKEN_COOKIE_ID,
  CSRF_TOKEN_HEADER,
  AUTH_ROUTE,
} from '../app.config';

const SESSION_SECRET = process.env.SESSION_SECRET;

if (! SESSION_SECRET) throw new Error('Env var SESSION_SECRET not provided');

// -- Should only be set in some testing environments
const IS_CSRF_DISABLED : boolean = (process.env?.CSRF_DISABLED === 'TRUE');

// -- Skips login route, in order to enable initial authentication
const skipSelectedCsrf = (req: Request): boolean => {
  return (req.path === `${AUTH_ROUTE}/login`);
};// -- end skipSelectedCsrf

// -- Skips all routes; used in selected testing environments
const skipAllCsrf = (_req: Request): true => true;

export const {
  invalidCsrfTokenError,
  generateCsrfToken,
  validateRequest,
  doubleCsrfProtection,
} = doubleCsrf({
  getSecret(): string {
    return SESSION_SECRET;
  },
  getSessionIdentifier(req: Request): string {
    if (! req.res) throw new Error('No res provided on req');

    const res = req.res;

    const sessionId = req.cookies[SESSION_ID_COOKIE_ID];

    if (! validateUuid(sessionId)) {
      // -- Generate a new session ID and set the cookie
      const sessionId = uuidv4();

      res.cookie(SESSION_ID_COOKIE_ID, sessionId, {
        httpOnly: true,
        sameSite: true,
        secure: IS_PRODUCTION,
      });
      return sessionId;
    }

    return sessionId;
  },
  cookieName: SESSION_TOKEN_COOKIE_ID,
  getCsrfTokenFromRequest(req: Request) {
    const tokenHeader = req.headers[CSRF_TOKEN_HEADER];
    if (! tokenHeader) return undefined;

    const token = Array.isArray(tokenHeader) ? tokenHeader[0] : tokenHeader;

    return token;
  },
  // -- May want to skip all CSRF protection in select testing environments
  skipCsrfProtection: IS_CSRF_DISABLED ? skipAllCsrf : skipSelectedCsrf,
  size: 32,
  ignoredMethods: ["GET", "HEAD", "OPTIONS"],
  cookieOptions: {
    path: '/',
    sameSite: 'strict',
    httpOnly: true,
    secure: IS_PRODUCTION,
  },
});// -- end doubleCsrf
