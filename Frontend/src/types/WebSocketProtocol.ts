// === Web Socket Protocol =====================================================
//
// Defines formats of JSON messages to be passed between the client and the
// web socket server.
//
// ServerMessage enumerates messages the server can send to the client, while
// ClientMessage enumerates the messages the client can send to the server.
//
// =============================================================================

// --- local imports
import type {
  CanvasObjectIdType,
  CanvasObjectModel,
  CanvasObjectRecord,
} from '@/types/CanvasObjectModel';

import type {
  UserPermission,
} from '@/types/APIProtocol';

// The unique identifier for clients within a web socket session.
export type ClientIdType = string;

// -- string represents Mongo ObjectId
export type UserIdType = string;

// Unique identifier for each canvas within a whiteboard
// -- string represents Mongo ObjectId
export type CanvasIdType = string;

// Unique identifier for each whiteboard
export type WhiteboardIdType = string;

// User presence update (canonical list of active users)
export interface UserSummary {
  clientId: ClientIdType;
  userId: UserIdType;
  username: string;
}

export interface CanvasAttribs {
  id: CanvasIdType;
  width: number;
  height: number;
  name: string;
  parentCanvas?: {
    canvasId: string;
    originX: number;
    originY: number;
  };
  timeCreated: string;
  timeLastModified: string;
}

// Contains nested data
export interface CanvasData extends CanvasAttribs {
  shapes: Record<CanvasObjectIdType, CanvasObjectModel>,
  allowedUsers: string[];
}

export interface CanvasRecord extends CanvasAttribs {
  whiteboardId: WhiteboardIdType;
}

export interface WhiteboardAttribs {
  id: WhiteboardIdType;
  name: string;
  rootCanvas: WhiteboardIdType;
  userPermissions: UserPermission[];
}

// Contains nested data
export interface WhiteboardData extends WhiteboardAttribs {
  canvases: CanvasData[];
}

export type WhiteboardRecord = WhiteboardAttribs;

// ========================== SERVER → CLIENT ==================================
//
// =============================================================================

// === Enumerate all error messages the server may send ========================

// -- previous message from client was invalid in some form (invalid json, non-existent message
// type, invalid message format, etc.)
export interface ClientErrorInvalidMessage {
  type: 'invalid_message';
  clientMessageRaw: string;
}

// -- client did not send an auth token
export interface ClientErrorUnauthorized {
  type: 'unauthorized';
}

// -- client not authorized to view this whiteboard at all
export interface ClientErrorNotAuthenticated {
  type: 'not_authenticated';
}

// -- client already authorized (cannot re-authenticate within the same connection)
export interface ClientErrorAlreadyAuthorized {
  type: 'already_authorized';
}

// -- client's auth token is somehow malformed
export interface ClientErrorInvalidAuth {
  type: 'invalid_auth';
}

// -- client's auth token has expired
export interface ClientErrorAuthTokenExpired {
  type: 'auth_token_expired';
}

// -- Client attempted to sign in as or access user that doesn't exist
export interface ClientErrorUserNotFound {
  type: 'user_not_found';
  userId: string;
}

// -- Client attempted to access whiteboard that doesn't exist
export interface ClientErrorWhiteboardNotFound {
  type: 'whiteboard_not_found';
  whiteboardId: string;
}

// -- Client attempted to access canvas that doesn't exist
export interface ClientErrorCanvasNotFound {
  type: 'canvas_not_found';
  canvasId: string;
}

// -- client doesn't have permission to perform a given action
export interface ClientErrorActionForbidden {
  type: 'action_forbidden';
  // -- description of the forbidden action that was attempted
  action: string;
}

// -- misc. errors not neatly handled by the above common cases
export interface ClientErrorOther {
  type: 'other';

  // -- descriptive message to send to client
  // -- make sure it excludes sensitive information
  message: string;
}

export type ClientError =
  | ClientErrorInvalidMessage
  | ClientErrorUnauthorized
  | ClientErrorNotAuthenticated
  | ClientErrorAlreadyAuthorized
  | ClientErrorInvalidAuth
  | ClientErrorAuthTokenExpired
  | ClientErrorUserNotFound
  | ClientErrorWhiteboardNotFound
  | ClientErrorCanvasNotFound
  | ClientErrorActionForbidden
  | ClientErrorOther
;

// Sent to an individual client to initialize the whiteboard on their end
export interface ServerMessageInitClient {
  type: "init_client";
  clientId: ClientIdType;
  whiteboard: WhiteboardData;
  activeClients: Record<ClientIdType, UserSummary>;
}

export interface ServerMessageLoginUsers {
  type: 'login_users';
  users: UserSummary[];
}

export interface ServerMessageLogoutUsers {
  type: 'logout_users';
  users: ClientIdType[];
}

// Used to notify clients when a user has started editing a canvas but hasn't
// performed any edits yet (i.e. when they click and drag to start drawing a
// shape).
export interface ServerMessageEditingCanvas {
  type: 'editing_canvas';
  clientId: ClientIdType;
  canvasId: CanvasIdType;
}

// Creates a new shape in a canvas
export interface ServerMessageCreateShapes {
  type: "create_shapes";
  clientId: ClientIdType;
  canvasId: CanvasIdType;
  shapes: Record<CanvasObjectIdType, CanvasObjectRecord>;
}

// Update existing shapes in a canvas
export interface ServerMessageUpdateShapes {
  type: "update_shapes";
  clientId: ClientIdType;
  canvasId: CanvasIdType;
  shapes: Record<CanvasObjectIdType, CanvasObjectRecord>;
}

export interface ServerMessageCreateCanvas {
  type: "create_canvas";
  clientId: ClientIdType;
  canvas: CanvasData;
}

export interface ServerMessageDeleteCanvases {
  type: "delete_canvases";
  clientId: ClientIdType;
  canvasIds: CanvasIdType[];
}

export interface ServerMessageUpdateAllowedUsers {
  type: 'update_canvas_allowed_users';
  canvasId: string;
  allowedUsers: string[];
}

export interface ServerMessageDeleteCanvasObjects {
  type: 'delete_canvas_objects';
  clientId: ClientIdType;
  canvasObjectIds: CanvasObjectIdType[];
}

export interface ServerMessageMergeCanvas {
  type: 'merge_canvas';
  clientId: ClientIdType;
  canvasId: string;
}

export interface ServerMessageIndividualError {
  type: 'individual_error';
  clientId: ClientIdType;
  error: ClientError;
}

export interface ServerMessageBroadcastError {
  type: 'broadcast_error';
  error: ClientError;
}

// Tagged union of all possible client-server messages
export type SocketServerMessage =
  | ServerMessageInitClient
  | ServerMessageLoginUsers
  | ServerMessageLogoutUsers
  | ServerMessageEditingCanvas
  | ServerMessageCreateShapes
  | ServerMessageUpdateShapes
  | ServerMessageCreateCanvas
  | ServerMessageDeleteCanvases
  | ServerMessageIndividualError
  | ServerMessageBroadcastError
  | ServerMessageUpdateAllowedUsers
  | ServerMessageDeleteCanvasObjects
  | ServerMessageMergeCanvas
;

// ========================== CLIENT → SERVER ==================================

// Notify server of identity on first connection
export interface ClientMessageLogin {
  type: "login";
  jwt: string;
}

// Used to notify clients when a user has started editing a canvas but hasn't
// performed any edits yet (i.e. when they click and drag to start drawing a
// shape).
export interface ClientMessageEditingCanvas {
  type: 'editing_canvas';
  canvasId: CanvasIdType;
}

// Notify the server that the client has created a new shape.
export interface ClientMessageCreateShapes {
  type: "create_shapes";
  canvasId: CanvasIdType;
  shapes: CanvasObjectModel[];
}

// Notify the server that the client has updated shape(s)
export interface ClientMessageUpdateShapes {
  type: "update_shapes";
  canvasId: CanvasIdType;
  shapes: Record<CanvasObjectIdType, CanvasObjectModel>;
}

// Notify server that client has created a new canvas
export interface ClientMessageCreateCanvas {
  type: "create_canvas";
  width: number;
  height: number;
  name: string;
  parentCanvas: {
    canvasId: CanvasIdType;
    originX: number;
    originY: number;
  };
  allowedUsers?: string[];
}

// Notify server that client has deleted canvases
export interface ClientMessageDeleteCanvases {
  type: "delete_canvases";
  canvasIds: CanvasIdType[];
}

// Notify server that client has updated allowed users in a canvas
export interface ClientMessageUpdateAllowedUsers {
  type: "update_canvas_allowed_users";
  canvasId: string;
  allowedUsers: string[];
}

export interface ClientMessageDeleteCanvasObjects {
  type: 'delete_canvas_objects';
  canvasObjectIds: CanvasObjectIdType[];
}

export interface ClientMessageMergeCanvas {
  type: 'merge_canvas';
  canvasId: CanvasIdType;
}

// Tagged union of all possible client-server messages
export type SocketClientMessage =
  | ClientMessageLogin
  | ClientMessageEditingCanvas
  | ClientMessageCreateShapes
  | ClientMessageUpdateShapes
  | ClientMessageCreateCanvas
  | ClientMessageDeleteCanvases
  | ClientMessageUpdateAllowedUsers
  | ClientMessageDeleteCanvasObjects
  | ClientMessageMergeCanvas
;
