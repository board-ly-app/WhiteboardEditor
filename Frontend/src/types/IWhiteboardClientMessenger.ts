// === Whiteboard Client Messenger Interface ===================================
//
// Interface that defines a messenger that handles sending client-origin
// messages that mutate Whiteboard state. Messages are presumably sent to the
// authoritative source of truth for the Whiteboard (presumably a server).
//
// =============================================================================

// -- local imports

import {
  type ClientMessageUpdateAllowedUsers,
  type ClientMessageLogin,
  type ClientMessageDeleteCanvases,
  type ClientMessageCreateShapes,
  type ClientMessageDeleteCanvasObjects,
  type ClientMessageEditingCanvas,
  type ClientMessageCreateCanvas,
  type ClientMessageUpdateShapes,
} from '@/types/WebSocketProtocol';

export interface IWhiteboardClientMessenger {
  sendUpdateCanvasAllowedUsers: (msg: ClientMessageUpdateAllowedUsers) => unknown;
  sendLogin: (msg: ClientMessageLogin) => unknown;
  sendDeleteCanvases: (msg: ClientMessageDeleteCanvases) => unknown;
  sendCreateShapes: (msg: ClientMessageCreateShapes) => unknown;
  sendDeleteCanvasObjects: (msg: ClientMessageDeleteCanvasObjects) => unknown;
  sendEditingCanvas: (msg: ClientMessageEditingCanvas) => unknown;
  sendCreateCanvas: (msg: ClientMessageCreateCanvas) => unknown;
  sendUpdateShapes: (msg: ClientMessageUpdateShapes) => unknown;
}// -- end interface IWhiteboardClientMessenger
