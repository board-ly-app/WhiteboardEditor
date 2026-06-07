// === Whiteboard Socket Messenger =============================================
//
// =============================================================================

// -- local imports
import {
  type ClientMessageSetCursorPos,
  type ClientMessageLogin,
  type ClientMessageEditingCanvas,
  type ClientMessageSelectedCanvasObject,
  type ClientMessageUnselectedCanvasObject,
  type ClientMessageCreateCanvasObjects,
  type ClientMessageUpdateCanvasObjects,
  type ClientMessageDeleteCanvasObjects,
  type ClientMessageCreateCanvas,
  type ClientMessageMergeCanvas,
  type ClientMessageDeleteCanvases,
  type ClientMessageUpdateAllowedUsers,
  type ClientMessageUndoHistory,
  type ClientMessageRequestCanvasEditPermission,
} from '@/types/WebSocketProtocol';

class WhiteboardSocketMessenger {
  #socket : WebSocket;

  constructor(socket: WebSocket) {
    this.#socket = socket;
  }// -- end constructor

  #sendMessage(msg: object) {
    this.#socket.send(JSON.stringify(msg));
  }// -- end sendMessage

  sendSetCursorPos(msg: ClientMessageSetCursorPos) {
    this.#sendMessage(msg);
  }// -- end sendSetCursorPos

  sendUpdateCanvasAllowedUsers(msg: ClientMessageUpdateAllowedUsers) {
    this.#sendMessage(msg);
  }// -- end sendUpdateCanvasAllowedUsers

  sendLogin(msg: ClientMessageLogin) {
    this.#sendMessage(msg);
  }// -- end sendLogin

  sendMergeCanvas(msg: ClientMessageMergeCanvas) {
    this.#sendMessage(msg);
  }// -- end sendMergeCanvas

  sendDeleteCanvases(msg: ClientMessageDeleteCanvases) {
    this.#sendMessage(msg);
  }// -- end sendDeleteCanvases

  sendCreateCanvasObjects(msg: ClientMessageCreateCanvasObjects) {
    this.#sendMessage(msg);
  }// -- end sendCreateCanvasObjects

  sendDeleteCanvasObjects(msg: ClientMessageDeleteCanvasObjects) {
    this.#sendMessage(msg);
  }// -- end sendDeleteCanvasObjects

  sendEditingCanvas(msg: ClientMessageEditingCanvas) {
    this.#sendMessage(msg);
  }// -- end sendEditingCanvas

  sendSelectedCanvasObject(msg: ClientMessageSelectedCanvasObject) {
    this.#sendMessage(msg);
  }// -- end sendSelectedCanvasObject

  sendUnselectedCanvasObject(msg: ClientMessageUnselectedCanvasObject) {
    this.#sendMessage(msg);
  }// -- end sendUnselectedCanvasObject

  sendCreateCanvas(msg: ClientMessageCreateCanvas) {
    this.#sendMessage(msg);
  }// -- end sendCreateCanvas

  sendUpdateCanvasObjects(msg: ClientMessageUpdateCanvasObjects) {
    this.#sendMessage(msg);
  }// -- end sendUpdateCanvasObjects

  sendUndoHistory(msg: ClientMessageUndoHistory) {
    this.#sendMessage(msg);
  }// -- end sendUndoHistory

  sendRequestCanvasEditPermission(msg: ClientMessageRequestCanvasEditPermission) {
    this.#sendMessage(msg);
  }// -- end sendUndoHistory
};

export {
  WhiteboardSocketMessenger
};
