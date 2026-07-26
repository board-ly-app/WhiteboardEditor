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

import lodash from 'lodash';

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
  const draftState : RootState = lodash.cloneDeep(state);
  const whiteboardIds : WhiteboardIdType[] = action.payload;

  for (const whiteboardId of whiteboardIds) {
    if (! (whiteboardId in draftState.whiteboards)) continue;
    
    const canvasIds : CanvasIdType[] = Object.keys(
      draftState.canvasesByWhiteboard.canvasesByWhiteboard[whiteboardId]
    );

    for (const canvasId of canvasIds) {
      if (! (canvasId in draftState.canvases)) continue;

      // -- remove current editor entry, if set
      if (canvasId in draftState.currentEditorsByCanvas.currentEditorsByCanvas) {
        const userId = draftState.currentEditorsByCanvas.currentEditorsByCanvas[canvasId];
        delete draftState.currentEditorsByCanvas.canvasesByCurrentEditor[userId];
        delete draftState.currentEditorsByCanvas.currentEditorsByCanvas[canvasId];
      }

      // -- delete allowed user entries, if set
      if (canvasId in draftState.allowedUsersByCanvas) {
        delete draftState.allowedUsersByCanvas[canvasId];
      }

      // -- delete child canvas entries
      if (canvasId in draftState.childCanvasesByCanvas.parentCanvasesByCanvas) {
        delete draftState.childCanvasesByCanvas.parentCanvasesByCanvas[canvasId];
      }

      if (canvasId in draftState.childCanvasesByCanvas.childCanvasesByCanvas) {
        delete draftState.childCanvasesByCanvas.childCanvasesByCanvas[canvasId];
      }

      // -- delete associated canvas objects
      if (canvasId in draftState.canvasObjectsByCanvas.canvasObjectsByCanvas) {
        const objIds = Object.keys(draftState.canvasObjectsByCanvas.canvasObjectsByCanvas[canvasId]);

        for (const objId of objIds) {
          delete draftState.canvasObjects[objId];
          delete draftState.canvasObjectsByCanvas.canvasesByCanvasObjects[objId];

          // -- Remove selectors
          if (objId in draftState.selectorsByCanvasObject.selectorsByCanvasObject) {
            const selectorId = draftState.selectorsByCanvasObject.selectorsByCanvasObject[objId];

            delete draftState.selectorsByCanvasObject.canvasObjectsBySelector[selectorId];
            delete draftState.selectorsByCanvasObject.selectorsByCanvasObject[objId];
          }
        }

        delete draftState.canvasObjectsByCanvas.canvasObjectsByCanvas[canvasId];
      }

      delete draftState.canvases[canvasId];
    }// -- end for canvasId

    // -- delete activeUser records
    if (whiteboardId in draftState.activeUsersByWhiteboard.clientsByWhiteboard) {
      const clientIds = Object.keys(
        draftState.activeUsersByWhiteboard.clientsByWhiteboard[whiteboardId]
      );

      for (const clientId of clientIds) {
        delete draftState.activeUsers[clientId];
        delete draftState.activeUsersByWhiteboard.whiteboardsByClient[clientId];
      }// -- end for clientId

      delete draftState.activeUsersByWhiteboard.clientsByWhiteboard[whiteboardId];
    }

    // Don't bother updating whiteboardStatuses; we want a record of the
    // whiteboard having been deleted so the user will be redirected to their
    // dashboard if they try to return to the whiteboard page.

    delete draftState.whiteboards[whiteboardId];
  }// -- end for whiteboardId

  return draftState;
};// -- end deleteWhiteboardsReducer
