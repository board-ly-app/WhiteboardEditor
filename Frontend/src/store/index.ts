import {
  configureStore,
  combineReducers,
} from '@reduxjs/toolkit'

import activeUsersReducer, {
  type ActiveUsersActions,
} from './activeUsers/activeUsersSlice';
import activeUsersByWhiteboardReducer, {
  type ActiveUsersByWhiteboardActions,
} from './activeUsers/activeUsersByWhiteboardSlice';
import currentEditorsByCanvasReducer, {
  type CurrentEditorsByCanvasActions,
} from './activeUsers/currentEditorsByCanvasSlice';
import canvasObjectsReducer, {
  type CanvasObjectsActions,
} from './canvasObjects/canvasObjectsSlice';
import allowedUsersByCanvasReducer, {
  type AllowedUsersByCanvasActions,
} from './allowedUsers/allowedUsersByCanvasSlice';
import canvasObjectsByCanvasReducer, {
  type CanvasObjectsByCanvasActions,
} from './canvasObjects/canvasObjectsByCanvasSlice';
import selectedCanvasObjectsReducer, {
  type SelectedCanvasObjectsActions,
} from './canvasObjects/selectedCanvasObjectsSlice';
import canvasesReducer, {
  type CanvasesActions,
} from './canvases/canvasesSlice';
import childCanvasesByCanvasReducer, {
  type ChildCanvasesByCanvasActions,
} from './canvases/childCanvasesByCanvasSlice';
import canvasesByWhiteboardReducer, {
  type CanvasesByWhiteboardActions,
} from './canvases/canvasesByWhiteboardSlice';
import selectedCanvasByWhiteboardReducer, {
  type SelectedCanvasByWhiteboardActions,
} from './canvases/selectedCanvasByWhiteboardSlice';
import whiteboardsReducer, {
  type WhiteboardsActions,
} from './whiteboards/whiteboardsSlice';
import whiteboardStatusReducer, {
  type WhiteboardStatusActions,
} from './whiteboards/whiteboardStatusSlice';

// -- root reducers
import {
  mergeCanvasReducer,
  mergeCanvasAction,
  type MergeCanvasActionType,
} from '@/store/canvases/mergeCanvasesReducer';

import {
  deleteWhiteboardsReducer,
  deleteWhiteboardsAction,
  type DeleteWhiteboardsActionType,
} from '@/store/whiteboards/deleteWhiteboardsReducer';

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
  | ActiveUsersActions
  | ActiveUsersByWhiteboardActions
  | CurrentEditorsByCanvasActions
  | CanvasObjectsActions
  | AllowedUsersByCanvasActions
  | CanvasObjectsByCanvasActions
  | SelectedCanvasObjectsActions
  | CanvasesActions
  | ChildCanvasesByCanvasActions
  | CanvasesByWhiteboardActions
  | SelectedCanvasByWhiteboardActions
  | WhiteboardsActions
  | WhiteboardStatusActions
  | MergeCanvasActionType
  | DeleteWhiteboardsActionType
;

export const store = configureStore({
  reducer: (state, action: ActionType) => {
    switch (action.type) {
      case mergeCanvasAction.type:
        return mergeCanvasReducer(state, action);
      case deleteWhiteboardsAction.type:
        return deleteWhiteboardsReducer(state, action);
      default:
        return rootReducer(state, action);
    }// -- end switch action.type
  },
});

export type RootState = ReturnType<typeof rootReducer>;
export type AppDispatch = typeof store.dispatch;
