// === Whiteboard Client Messenger Interface ===================================
//
// Interface that defines a messenger that handles sending client-origin
// messages that mutate Whiteboard state. Messages are presumably sent to the
// authoritative source of truth for the Whiteboard (presumably a server).
//
// =============================================================================

// -- local imports

import {
  type ClientMessageSetCursorPos,
  type ClientMessageUpdateAllowedUsers,
  type ClientMessageLogin,
  type ClientMessageDeleteCanvases,
  type ClientMessageMergeCanvas,
  type ClientMessageCreateCanvasObjects,
  type ClientMessageDeleteCanvasObjects,
  type ClientMessageEditingCanvas,
  type ClientMessageSelectedCanvasObjects,
  type ClientMessageUnselectedCanvasObjects,
  type ClientMessageCreateCanvas,
  type ClientMessageUpdateCanvasObjects,
  type ClientMessageUndoHistory,
  type ClientMessageRequestCanvasEditPermission,
} from '@/types/WebSocketProtocol';

export interface IWhiteboardClientMessenger {
  sendSetCursorPos: (msg: ClientMessageSetCursorPos) => unknown;
  sendUpdateCanvasAllowedUsers: (msg: ClientMessageUpdateAllowedUsers) => unknown;
  sendLogin: (msg: ClientMessageLogin) => unknown;
  sendDeleteCanvases: (msg: ClientMessageDeleteCanvases) => unknown;
  sendCreateCanvasObjects: (msg: ClientMessageCreateCanvasObjects) => unknown;
  sendDeleteCanvasObjects: (msg: ClientMessageDeleteCanvasObjects) => unknown;
  sendEditingCanvas: (msg: ClientMessageEditingCanvas) => unknown;
  sendSelectedCanvasObjects: (msg: ClientMessageSelectedCanvasObjects) => unknown;
  sendUnselectedCanvasObjects: (msg: ClientMessageUnselectedCanvasObjects) => unknown;
  sendCreateCanvas: (msg: ClientMessageCreateCanvas) => unknown;
  sendMergeCanvas: (msg: ClientMessageMergeCanvas) => unknown;
  sendUpdateCanvasObjects: (msg: ClientMessageUpdateCanvasObjects) => unknown;
  sendUndoHistory: (msg: ClientMessageUndoHistory) => unknown;
  sendRequestCanvasEditPermission: (msg: ClientMessageRequestCanvasEditPermission) => unknown;
}// -- end interface IWhiteboardClientMessenger
