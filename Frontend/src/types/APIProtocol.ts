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

// -- For now, just a basic representation for a MongoDB ObjectId
export type ObjectIdType = string;

// === User ====================================================================
//
// Basic data about a user.
//
// =============================================================================

interface UserBase {
  id: string;
  username: string;
}

export interface PermanentUser extends UserBase {
  kind: 'permanent';
  email: string;
}

export interface TempUser extends UserBase {
  kind: 'temp';
  createdAt: Date;
}

export type User =
  | PermanentUser
  | TempUser
;

// === UserPermissionEnum ======================================================
//
// Specifies the permissions a user can have on a whiteboard.
//
// - view: only view the whiteboard
// - edit: view and make edits to the canvases within the whiteboard
// - own: view ane edit the whiteboard, as well as change user permissions and
// change metadata such as the whiteboard name.
//
// =============================================================================
export type UserPermissionEnum = 
  | 'view'
  | 'edit'
  | 'own'
;

export const USER_PERMISSION_TYPES = [
  'view',
  'edit',
  'own'
];

export interface UserPermissionByUser {
  type: 'user';
  user: User;
  permission: UserPermissionEnum;
}

export interface UserPermissionByEmail {
  type: 'email';
  email: string;
  permission: UserPermissionEnum;
}

// === UserPermission ==========================================================
//
// Specifies the permissions a user has on a given whiteboard. The permissions
// are. Permissions may be specified by either user id or email address. Email
// address permissions need not correspond to an existing user account; this
// permission will be attached to an account by user id when an account with the
// given email address is created.
//
// =============================================================================
export type UserPermission =
  | UserPermissionByUser
  | UserPermissionByEmail
;

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
  time_created: Date;
  thumbnail_url: string;
  user_permissions: UserPermission[];
  canvases?: Canvas[];
}

export interface TempWhiteboard extends WhiteboardBase {
  kind: 'temp';
}

export interface PermanentWhiteboard extends WhiteboardBase {
  kind: 'permanent';
}

export type Whiteboard =
  | TempWhiteboard
  | PermanentWhiteboard
;

// === AuthLoginSuccessResponse ================================================
//
// Defines the body of a response to a successful login request.
//
// =============================================================================
export interface AuthLoginSuccessResponse {
  user: User;
  token: string;
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
