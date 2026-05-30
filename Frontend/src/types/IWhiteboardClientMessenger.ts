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
  type ClientMessageSelectedCanvasObject,
  type ClientMessageUnselectedCanvasObject,
  type ClientMessageCreateCanvas,
  type ClientMessageUpdateCanvasObjects,
  type ClientMessageUndoHistory,
} from '@/types/WebSocketProtocol';

export interface IWhiteboardClientMessenger {
  sendSetCursorPos: (msg: ClientMessageSetCursorPos) => unknown;
  sendUpdateCanvasAllowedUsers: (msg: ClientMessageUpdateAllowedUsers) => unknown;
  sendLogin: (msg: ClientMessageLogin) => unknown;
  sendDeleteCanvases: (msg: ClientMessageDeleteCanvases) => unknown;
  sendCreateCanvasObjects: (msg: ClientMessageCreateCanvasObjects) => unknown;
  sendDeleteCanvasObjects: (msg: ClientMessageDeleteCanvasObjects) => unknown;
  sendEditingCanvas: (msg: ClientMessageEditingCanvas) => unknown;
  sendSelectedCanvasObject: (msg: ClientMessageSelectedCanvasObject) => unknown;
  sendUnselectedCanvasObject: (msg: ClientMessageUnselectedCanvasObject) => unknown;
  sendCreateCanvas: (msg: ClientMessageCreateCanvas) => unknown;
  sendMergeCanvas: (msg: ClientMessageMergeCanvas) => unknown;
  sendUpdateCanvasObjects: (msg: ClientMessageUpdateCanvasObjects) => unknown;
  sendUndoHistory: (msg: ClientMessageUndoHistory) => unknown;
}// -- end interface IWhiteboardClientMessenger
