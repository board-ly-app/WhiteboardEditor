// === Authentication Middleware ===============================================
//
// Ensures that a valid JWT is supplied as authorization to authenticated
// endpoints.
//
// =============================================================================

import {
  Request,
  Response,
  NextFunction,
} from "express";

import {
  ACCESS_TOKEN_COOKIE_ID,
} from '../app.config';

import {
  type AuthorizedRequestBody
} from '../models/Auth';

import {
  verifyUserFromAccessToken,
} from '../services/authService';

const ACCESS_TOKEN_SECRET = process.env.ACCESS_TOKEN_SECRET;

if (! ACCESS_TOKEN_SECRET) {
  console.error('ERROR: missing required env var ACCESS_TOKEN_SECRET');
  process.exit(1);
}

export const authenticateJWT = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    if (! (ACCESS_TOKEN_COOKIE_ID in req.cookies)) {
      return res.status(401).json({ error: "Missing token" });
    }

    const token = req.cookies[ACCESS_TOKEN_COOKIE_ID];

    const verifyTokenRes = await verifyUserFromAccessToken(token);

    switch (verifyTokenRes.kind) {
      case 'no_user':
      case 'invalid_token':
        console.log('Access token rejected:', verifyTokenRes.kind);
        return res.status(403).json({ error: "Invalid or expired token" });
      case 'ok':
        {
          if (! req.body) {
            req.body = { authUser: verifyTokenRes.user };
          } else {
            (req.body as AuthorizedRequestBody).authUser = verifyTokenRes.user;
          }

          return next();
        }
      default:
        throw new Error('Unrecognized verify token result kind');
    }// -- end switch (verifyTokenRes.kind)
  } catch (e: any) {
    if (process.env.NODE_ENV !== 'production') {
      console.error('Authorization error:', e);
    } else {
      console.error('Authorization error');
    }

    return res.status(500).json({ error: "Internal server error." });
  }
};// -- end authenticateJWT

export const authenticateJWTOptional = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    if (! (ACCESS_TOKEN_COOKIE_ID in req.cookies)) {
      return next();
    }

    const token = req.cookies[ACCESS_TOKEN_COOKIE_ID];

    const verifyTokenRes = await verifyUserFromAccessToken(token);

    switch (verifyTokenRes.kind) {
      case 'no_user':
      case 'invalid_token':
        // -- Just pass immediatebly to next function
        return next();
      case 'ok':
        {
          if (! req.body) {
            req.body = { authUser: verifyTokenRes.user };
          } else {
            (req.body as AuthorizedRequestBody).authUser = verifyTokenRes.user;
          }

          return next();
        }
      default:
        throw new Error('Unrecognized verify token result kind');
    }// -- end switch (verifyTokenRes.kind)
  } catch (e: any) {
    if (process.env.NODE_ENV !== 'production') {
      console.error('Authorization error:', e);
    } else {
      console.error('Authorization error');
    }

    return res.status(500).json({ error: "Internal server error." });
  }
};// -- end authenticateJWTOptional
