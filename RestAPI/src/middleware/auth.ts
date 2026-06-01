// === Authentication Middleware ===============================================
//
// Ensures that a valid JWT is supplied as authorization to authenticated
// endpoints.
//
// =============================================================================

import { Request, Response, NextFunction } from "express";
import { Types } from "mongoose";
import jwt from "jsonwebtoken";

import type {
  AuthPayload,
  AuthorizedRequestBody
} from '../models/Auth';

const JWT_SECRET = process.env.JWT_SECRET;

if (! JWT_SECRET) {
  console.error('ERROR: missing required env var JWT_SECRET');
  process.exit(1);
}

export const authenticateJWT = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  const authHeader = req.headers.authorization;

  if (!authHeader?.startsWith("Bearer ")) {
    res.status(401).json({ error: "Missing token" });
    return;
  }

  const token = authHeader.split(" ")[1];

  try {
    const payload = jwt.verify(token, JWT_SECRET) as AuthPayload;
    const authUser = ({
      id: new Types.ObjectId(payload.sub)
    });

    // attach user id to request body for controllers
    if (! req.body) {
      req.body = { authUser };
    } else {
      (req.body as AuthorizedRequestBody).authUser = authUser;
    }

    next();
  } catch (err) {
    console.log('Authorization error:', err);
    res.status(403).json({ error: "Invalid or expired token" });
  }
};

export const authenticateJWTOptional = async (
  req: Request,
  _res: Response,
  next: NextFunction
) => {
  const authHeader = req.headers.authorization;

  if (!authHeader?.startsWith("Bearer ")) {
    return next();
  }

  const token = authHeader.split(" ")[1];

  try {
    const payload = jwt.verify(token, JWT_SECRET) as AuthPayload;
    const authUser = ({
      id: new Types.ObjectId(payload.sub)
    });

    if (! req.body) {
      req.body = { authUser };
    } else {
      (req.body as AuthorizedRequestBody).authUser = authUser;
    }

    next();
  } catch (err) {
    // Invalid/expired token on an optional-auth endpoint — treat as unauthenticated
    return next();
  }
}
