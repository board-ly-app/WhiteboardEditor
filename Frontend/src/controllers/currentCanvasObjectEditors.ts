// -- local imports
import {
  type AppDispatch,
} from '@/store';

import {
  setCurrentEditorsByCanvasObject as setCurrentEditorsByCanvasObjectReducer,
  removeCurrentEditors as removeCurrentEditorsReducer,
  removeCurrentEditorsByCanvasObject as removeCurrentEditorsByCanvasObjectReducer,
} from '@/store/activeUsers/currentEditorsByCanvasObjectSlice.ts';

import {
  type ClientIdType,
} from '@/types/WebSocketProtocol';

import {
  type CanvasObjectIdType,
} from '@/types/CanvasObjectModel';

export const setCurrentEditorsByCanvasObject = (
  dispatch: AppDispatch,
  editorsByCanvasObject: Record<CanvasObjectIdType, ClientIdType>
) => {
  dispatch(setCurrentEditorsByCanvasObjectReducer(editorsByCanvasObject));
};

export const removeCurrentEditorsByClient = (
  dispatch: AppDispatch,
  clientIds: ClientIdType[]
) => {
  dispatch(removeCurrentEditorsReducer(clientIds));
};

export const removeCurrentEditorsByCanvasObject = (
  dispatch: AppDispatch,
  canvasObjectIds: CanvasObjectIdType[]
) => {
  dispatch(removeCurrentEditorsByCanvasObjectReducer(canvasObjectIds));
};
