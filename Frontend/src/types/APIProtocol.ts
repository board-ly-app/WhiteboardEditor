// === APIProtocol =============================================================
//
// Defines types of data transferred to and from the internal REST API.
//
// There is some overlap with the data transferred with the web socket protocol;
// care should be taken to distinguish data received from the API vs. via the
// web socket server.
//
// =============================================================================

// -- third-party imports
import {
  type AxiosResponse,
} from 'axios';

// -- local imports
import type {
  CanvasObjectModel
} from '@/types/CanvasObjectModel';

import {
  type UserPermission,
} from '@/types/UserPermission';

import {
  type User,
} from '@/types/User';

// -- For now, just a basic representation for a MongoDB ObjectId
export type ObjectIdType = string;

// === Canvas ==================================================================
//
// Contains all data about a canvas received via the REST API.
//
// Be aware that canvas data may not be completely up-to-date; up-to-date data
// on canvases and their contents should ideally be fetched from the web socket
// server.
//
// =============================================================================
export interface Canvas {
  id: string;
  width: number;
  height: number;
  time_created: Date;
  time_last_modified: Date;
  allowed_users?: User[];
  shapes?: Record<string, CanvasObjectModel>
}

// === Whiteboard ==============================================================
//
// Contains all data about a whiteboard received via the REST API.
//
// Be aware that canvas data may not be completely up-to-date; up-to-date data
// on canvases and their contents should ideally be fetched from the web socket
// server.
//
// =============================================================================
interface WhiteboardBase {
  id: string;
  name: string;
  thumbnail_url: string;
  user_permissions: UserPermission[];
  visibility: 'public' | 'private';
  time_last_modified?: Date;
  canvases?: Canvas[];
}

// the temp 'createdAt' is used for automatic deletion after expire time
export interface TempWhiteboard extends WhiteboardBase {
  kind: 'temp_whiteboard';
  createdAt: Date;
}

// the permanent 'time_created' is used for general documentation of creation time
export interface PermanentWhiteboard extends WhiteboardBase {
  kind: 'permanent_whiteboard';
  time_created: Date;
}

export type Whiteboard =
  | TempWhiteboard
  | PermanentWhiteboard
;

export interface LoginReqBody {
  authSource: string; 
  email: string; 
  password: string; 
}

export interface SignupReqBody {
  email: string; 
  username: string;
  password: string; 
}

// === LoginSuccessResponse ====================================================
//
// Defines the body of a response to a successful login request.
//
// =============================================================================
export interface LoginSuccessResponse {
  user: User;
  sessionToken: string;
}

export interface ConfirmAccountReqBody {
  token: string;
  password: string;
}

export const isConfirmAccountReqBody = (
  body: unknown
): body is ConfirmAccountReqBody => {
  if (! body) return false;
  if (typeof body !== 'object') return false;
  if (! ('token' in body)) return false;
  if (typeof body.token !== 'string') return false;
  if (! ('password' in body)) return false;
  if (typeof body.password !== 'string') return false;

  return true;
};// -- end isConfirmAccountReqBody

export interface SignupSuccessNoEmailResponse {
  kind: 'no_email';
  user: User;
  sessionToken: string;
}

export interface SignupSuccessEmailResponse {
  kind: 'email';
  email: string;
}

export type SignupSuccessResponse =
  | SignupSuccessNoEmailResponse
  | SignupSuccessEmailResponse
;

export interface SignupConfirmationSuccessResponse {
  user: User;
  sessionToken: string;
}

export interface AuthTempConversionPayload {
  tempUserId: string;
  permanentUserEmail: string;
  whiteboardId: string;
}

export const isAuthTempConversionPayload = (
  payload: unknown
): payload is AuthTempConversionPayload => {
  if (! payload) return false;
  if (typeof payload !== 'object') return false;
  if (! ('tempUserId' in payload)) return false;
  if (typeof payload.tempUserId !== 'string') return false;
  if (! ('permanentUserEmail' in payload)) return false;
  if (typeof payload.permanentUserEmail !== 'string') return false;
  if (! ('whiteboardId' in payload)) return false;
  if (typeof payload.whiteboardId !== 'string') return false;

  return true;
};// -- end isAuthTempConversionPayload

export interface PatchPermanentUserReqPayloadBase {
  email?: string;
  username?: string;
}

export interface PatchPermanentUserReqPayloadInitial
extends PatchPermanentUserReqPayloadBase {
  password?: string;
}

export interface PatchPermanentUserReqPayloadSigned
extends PatchPermanentUserReqPayloadBase {
  action: 'PATCH:/users';
  userId: string;
  passwordHashed?: string;
}

export const isPatchPermanentUserReqPayloadBase = (
  payload: unknown
): payload is PatchPermanentUserReqPayloadBase => {
  if (! payload) return false;
  if (typeof payload !== 'object') return false;

  // -- All other fields are optional; just check that they are the right type
  if (('email' in payload) && (typeof payload.email !== 'string')) return false;
  if (('username' in payload) && (typeof payload.username !== 'string')) return false;

  return true;
};// -- end isPatchPermanentUserReqPayload

export const isPatchPermanentUserReqPayloadInitial = (
  payload: unknown
): payload is PatchPermanentUserReqPayloadInitial => {
  if (! isPatchPermanentUserReqPayloadBase(payload)) return false;
  if (('password' in payload) && (typeof payload.password !== 'string')) return false;

  return true;
};// -- end isPatchPermanentUserReqPayloadInitial

export const isPatchPermanentUserReqPayloadSigned = (
  payload: unknown
): payload is PatchPermanentUserReqPayloadSigned => {
  if (! isPatchPermanentUserReqPayloadBase(payload)) return false;
  if (! ('action' in payload)) return false;
  if (payload.action !== 'PATCH:/users') return false;
  if (! ('userId' in payload)) return false;
  if (typeof payload.userId !== 'string') return false;
  if (('passwordHashed' in payload) && (typeof payload.passwordHashed !== 'string')) return false;

  return true;
};// -- end isPatchPermanentUserReqPayloadSigned

export interface PatchPermanentUserInitialReqBody {
  kind: 'initial';
  payload: PatchPermanentUserReqPayloadInitial;
}

export const isPatchPermanentUserInitialReqBody = (
  body: unknown
): body is PatchPermanentUserInitialReqBody => {
  if (! body) return false;
  if (typeof body !== 'object') return false;
  if (! ('kind' in body)) return false;
  if (body.kind !== 'initial') return false;
  if (! ('payload' in body)) return false;
  if (! isPatchPermanentUserReqPayloadInitial(body.payload)) return false;

  return true;
};// -- end isPatchPermanentUserInitialReqBody

export interface PatchPermanentUserConfirmReqBody {
  kind: 'confirm';
  // -- payload is a signed JWT
  payload: string;
}

export const isPatchPermanentUserConfirmReqBody = (
  body: unknown
): body is PatchPermanentUserConfirmReqBody => {
  if (! body) return false;
  if (typeof body !== 'object') return false;
  if (! ('kind' in body)) return false;
  if (body.kind !== 'confirm') return false;
  if (! ('payload' in body)) return false;
  if (typeof body.payload !== 'string') return false;

  return true;
};// -- end isPatchPermanentUserConfirmReqBody

export type PatchPermanentUserReqBody =
  | PatchPermanentUserInitialReqBody
  | PatchPermanentUserConfirmReqBody
;

export const isPatchPermanentUserReqBody = (
  body: unknown
): body is PatchPermanentUserReqBody => {
  return (
    isPatchPermanentUserInitialReqBody(body)
    || isPatchPermanentUserConfirmReqBody(body)
  );
};// -- end isPatchPermanentUserReqBody

export interface PatchPermanentUserResPayload {
  email: string;
  username: string;
}

export interface PatchPermanentUserPendingConfirmationResBody {
  kind: 'pending_confirmation';
  email: string;
}

export interface PatchPermanentUserConfirmedResBody {
  kind: 'confirmed';
  payload: PatchPermanentUserResPayload;
}

export type PatchPermanentUserResBody =
  | PatchPermanentUserPendingConfirmationResBody
  | PatchPermanentUserConfirmedResBody
;

export interface WhiteboardConvertTempToPermReqBody {
  signedConversionRequest: string;
}

export interface WhiteboardNewNameReqBody {
  newName: string;
}

// === ErrorResponse ===========================================================
//
// Standard error response.
//
// =============================================================================
export interface ErrorResponse {
  message: string;
}

// -- used to indicate that an axios response contains an error response
export const axiosResponseIsError = <OkRespType> (
  res: AxiosResponse<OkRespType | ErrorResponse>
): res is AxiosResponse<ErrorResponse> => {
  return res.status >= 400;
};
