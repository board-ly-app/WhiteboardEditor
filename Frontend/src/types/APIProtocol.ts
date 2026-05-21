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
