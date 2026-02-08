// === Whiteboard Socket Messenger =============================================
//
// =============================================================================

// -- local imports
import {
  type ClientMessageLogin,
  type ClientMessageEditingCanvas,
  type ClientMessageCreateShapes,
  type ClientMessageUpdateShapes,
  type ClientMessageDeleteCanvasObjects,
  type ClientMessageCreateCanvas,
  type ClientMessageDeleteCanvases,
  type ClientMessageUpdateAllowedUsers,
} from '@/types/WebSocketProtocol';

class WhiteboardSocketMessenger {
  #socket : WebSocket;

  constructor(socket: WebSocket) {
    this.#socket = socket;
  }// -- end constructor

  #sendMessage(msg: object) {
    this.#socket.send(JSON.stringify(msg));
  }// -- end sendMessage

  sendUpdateCanvasAllowedUsers(msg: ClientMessageUpdateAllowedUsers) {
    this.#sendMessage(msg);
  }// -- end sendUpdateCanvasAllowedUsers

  sendLogin(msg: ClientMessageLogin) {
    this.#sendMessage(msg);
  }// -- end sendLogin

  sendDeleteCanvases(msg: ClientMessageDeleteCanvases) {
    this.#sendMessage(msg);
  }// -- end sendDeleteCanvases

  sendCreateShapes(msg: ClientMessageCreateShapes) {
    this.#sendMessage(msg);
  }// -- end sendCreateShapes

  sendDeleteCanvasObjects(msg: ClientMessageDeleteCanvasObjects) {
    this.#sendMessage(msg);
  }// -- end sendDeleteCanvasObjects

  sendEditingCanvas(msg: ClientMessageEditingCanvas) {
    this.#sendMessage(msg);
  }// -- end sendEditingCanvas

  sendCreateCanvas(msg: ClientMessageCreateCanvas) {
    this.#sendMessage(msg);
  }// -- end sendCreateCanvas

  sendUpdateShapes(msg: ClientMessageUpdateShapes) {
    this.#sendMessage(msg);
  }// -- end sendUpdateShapes
};

export {
  WhiteboardSocketMessenger
};
