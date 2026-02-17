import {
  configureStore,
  combineReducers,
} from '@reduxjs/toolkit'

import activeUsersReducer from './activeUsers/activeUsersSlice';
import activeUsersByWhiteboardReducer from './activeUsers/activeUsersByWhiteboardSlice';
import currentEditorsByCanvasReducer from './activeUsers/currentEditorsByCanvasSlice';
import canvasObjectsReducer from './canvasObjects/canvasObjectsSlice';
import allowedUsersByCanvasReducer from './allowedUsers/allowedUsersByCanvasSlice';
import canvasObjectsByCanvasReducer from './canvasObjects/canvasObjectsByCanvasSlice';
import selectedCanvasObjectsReducer from './canvasObjects/selectedCanvasObjectsSlice';
import canvasesReducer from './canvases/canvasesSlice';
import childCanvasesByCanvasReducer from './canvases/childCanvasesByCanvasSlice';
import canvasesByWhiteboardReducer from './canvases/canvasesByWhiteboardSlice';
import selectedCanvasByWhiteboardReducer from './canvases/selectedCanvasByWhiteboardSlice';
import whiteboardsReducer from './whiteboards/whiteboardsSlice';
import whiteboardStatusReducer from './whiteboards/whiteboardStatusSlice';

// root reducers
import {
  mergeCanvasReducer,
  isMergeCanvasAction,
  type MergeCanvasActionType,
} from '@/store/canvases/mergeCanvasesReducer';

const rootReducer = combineReducers({
  activeUsers: activeUsersReducer,
  activeUsersByWhiteboard: activeUsersByWhiteboardReducer,
  currentEditorsByCanvas: currentEditorsByCanvasReducer,
  canvasObjects: canvasObjectsReducer,
  canvasObjectsByCanvas: canvasObjectsByCanvasReducer,
  selectedCanvasObjects: selectedCanvasObjectsReducer,
  allowedUsersByCanvas: allowedUsersByCanvasReducer,
  canvases: canvasesReducer,
  childCanvasesByCanvas: childCanvasesByCanvasReducer,
  canvasesByWhiteboard: canvasesByWhiteboardReducer,
  selectedCanvasByWhiteboard: selectedCanvasByWhiteboardReducer,
  whiteboards: whiteboardsReducer,
  whiteboardStatus: whiteboardStatusReducer,
});// -- end rootReducer

type ActionType =
  | Parameters<typeof rootReducer>[1]
  | MergeCanvasActionType
;

export const store = configureStore({
  reducer: (state, action: ActionType) => {
    if (isMergeCanvasAction(action)) {
      return mergeCanvasReducer(state, action as MergeCanvasActionType);
    } else {
      return rootReducer(state, action);
    }
  },
});

export type RootState = ReturnType<typeof rootReducer>;
export type AppDispatch = typeof store.dispatch;
