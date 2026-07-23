import {
  type Request,
  type Response,
} from 'express';
import {
  type ParamsDictionary,
  type Query,
} from 'express-serve-static-core';
import {
  Types,
} from 'mongoose';
import {
  type IUserType,
} from './User';

interface BaseAuthRequest {
  password?: string;
}

export interface EmailAuthRequest extends BaseAuthRequest {
  authSource?: 'email';
  email?: string;
}

export interface UsernameAuthRequest extends BaseAuthRequest {
  authSource?: 'username';
  username?: string;
}

export type AuthRequest = 
  | EmailAuthRequest
  | UsernameAuthRequest
;

// === AccessTokenPayload =============================================================
//
// The inner payload of a JWT used for authorization.
//
// =============================================================================
export interface AccessTokenPayload {
  sub: string;  // The user ID, as a string
}

export const isAccessTokenPayload = (payload: any): payload is AccessTokenPayload => {
  if (typeof payload !== 'object') return false;
  if (! Types.ObjectId.isValid(payload?.sub)) return false;

  return true;
};// -- end isAccessTokenPayload

export interface RefreshTokenPaylod {
  kind: 'refresh';
  userId: string;
}

export const isRefreshTokenPayload = (payload: any): payload is RefreshTokenPaylod => {
  if (typeof payload !== 'object') return false;
  if (payload?.kind !== 'refresh') return false;
  if (! Types.ObjectId.isValid(payload?.userId)) return false;

  return true;
};

// === AuthorizedRequest =======================================================
//
// Base type defining a request that has been processed and accepted by the
// authorization middleware. The middleware adds the authUser field, which
// contains the Mongoose IUserType object for the authenticated user.
//
// =============================================================================
interface AuthLocals {
  authUser: IUserType;
}

export type AuthorizedRequest<
  P = ParamsDictionary,
  ResBody = any,
  ReqBody = any,
  ReqQuery = Query,
  Locals = {},
> = Request <P, ResBody, ReqBody, ReqQuery, AuthLocals & Locals>;

export type AuthorizedResponse<
  ResBody = any,
  Locals = {},
> = Response <ResBody, AuthLocals & Locals>;

// === OptAuthorizedRequest ====================================================
//
// Base type defining a request that may or may not have been been processed and
// accepted by the authorization middleware. It may or may not contain the
// authUser field, which contains the Mongoose IUserType object for the
// authenticated user.
//
// =============================================================================
interface OptAuthLocals {
  authUser?: IUserType;
}

export type OptAuthorizedRequest<
  P = ParamsDictionary,
  ResBody = any,
  ReqBody = any,
  ReqQuery = Query,
  Locals = {},
> = Request <P, ResBody, ReqBody, ReqQuery, OptAuthLocals & Locals>;

export type OptAuthorizedResponse<
  ResBody = any,
  Locals = {},
> = Response <ResBody, OptAuthLocals & Locals>;
