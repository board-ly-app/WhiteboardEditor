import {
  type IUserType,
} from './User';

interface BaseAuthRequest {
  password: string;
}

export interface EmailAuthRequest extends BaseAuthRequest {
  authSource: 'email';
  email: string;
}

export interface UsernameAuthRequest extends BaseAuthRequest {
  authSource: 'username';
  username: string;
}

export type AuthRequest = EmailAuthRequest | UsernameAuthRequest;

// === AuthPayload =============================================================
//
// The inner payload of a JWT used for authorization.
//
// =============================================================================
export interface AuthPayload {
  sub: string;  // The user ID, as a string
}

// === AuthorizedRequestBody ===================================================
//
// Base type defining minimum data to expect in the body of any request to an
// authorized endpoint.
//
// The authUser field will be set by the authentication middleware, rather than
// being sent by the client.
//
// =============================================================================
export interface AuthorizedRequestBody {
  authUser: IUserType;
}
