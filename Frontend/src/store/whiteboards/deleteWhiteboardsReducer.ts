// === deleteWhiteboardsReducer.ts =============================================
//
// Recursively deletes the whiteboards identified by their IDs, including all
// data "owned" by the whiteboard.
//
// =============================================================================

// -- third-party imports
import {
  createAction,
} from '@reduxjs/toolkit';

// -- local imports
import {
  type RootState,
} from '@/store';

import {
  type WhiteboardIdType,
  type CanvasIdType,
} from '@/types/WebSocketProtocol';

const DELETE_WHITEBOARDS_ACTION_TYPE = 'whiteboards/deleteWhiteboards';

export const deleteWhiteboardsAction = createAction<
  WhiteboardIdType[], typeof DELETE_WHITEBOARDS_ACTION_TYPE
>(
  DELETE_WHITEBOARDS_ACTION_TYPE
);

export type DeleteWhiteboardsActionType = ReturnType<typeof deleteWhiteboardsAction>;

export const deleteWhiteboardsReducer = (
  state: RootState,
  action: DeleteWhiteboardsActionType,
) => {
  // Recall, relations flow as follows:
  //  Whiteboard  => Canvas             => CurrentEditor
  //                                    => AllowedUser
  //                                    => ChildCanvas
  //                                    => CanvasObject
  //              => ActiveUser
  //              => WhiteboardStatus
  const whiteboardIds : WhiteboardIdType[] = action.payload;

  for (const whiteboardId of whiteboardIds) {
    if (! (whiteboardId in state.whiteboards)) continue;
    
    const canvasIds : CanvasIdType[] = Object.keys(
      state.canvasesByWhiteboard.canvasesByWhiteboard[whiteboardId]
    );

    for (const canvasId of canvasIds) {
      if (! (canvasId in state.canvases)) continue;

      // -- remove current editor entry, if set
      if (canvasId in state.currentEditorsByCanvas.currentEditorsByCanvas) {
        const userId = state.currentEditorsByCanvas.currentEditorsByCanvas[canvasId];
        delete state.currentEditorsByCanvas.canvasesByCurrentEditor[userId];
        delete state.currentEditorsByCanvas.currentEditorsByCanvas[canvasId];
      }

      // -- delete allowed user entries, if set
      if (canvasId in state.allowedUsersByCanvas) {
        delete state.allowedUsersByCanvas[canvasId];
      }

      // -- delete child canvas entries
      if (canvasId in state.childCanvasesByCanvas.parentCanvasesByCanvas) {
        delete state.childCanvasesByCanvas.parentCanvasesByCanvas[canvasId];
      }

      if (canvasId in state.childCanvasesByCanvas.childCanvasesByCanvas) {
        delete state.childCanvasesByCanvas.childCanvasesByCanvas[canvasId];
      }

      // -- delete associated canvas objects
      if (canvasId in state.canvasObjectsByCanvas.canvasObjectsByCanvas) {
        const objIds = Object.keys(state.canvasObjectsByCanvas.canvasObjectsByCanvas[canvasId]);

        for (const objId of objIds) {
          delete state.canvasObjects[objId];
          delete state.canvasObjectsByCanvas.canvasesByCanvasObjects[objId];
        }

        delete state.canvasObjectsByCanvas.canvasObjectsByCanvas[canvasId];
      }

      delete state.canvases[canvasId];
    }// -- end for canvasId

    // -- delete activeUser records
    if (whiteboardId in state.activeUsersByWhiteboard.clientsByWhiteboard) {
      const clientIds = Object.keys(
        state.activeUsersByWhiteboard.clientsByWhiteboard[whiteboardId]
      );

      for (const clientId of clientIds) {
        delete state.activeUsers[clientId];
        delete state.activeUsersByWhiteboard.whiteboardsByClient[clientId];
      }// -- end for clientId

      delete state.activeUsersByWhiteboard.clientsByWhiteboard[whiteboardId];
    }

    // Don't bother updating whiteboardStatuses; we want a record of the
    // whiteboard having been deleted so the user will be redirected to their
    // dashboard if they try to return to the whiteboard page.

    delete state.whiteboards[whiteboardId];
  }// -- end for whiteboardId


  return state;
};
