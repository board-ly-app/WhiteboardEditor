// -- local imports
import {
  type AppDispatch,
} from '@/store';

import {
  type ClientIdType,
  type WhiteboardIdType,
} from "@/types/WebSocketProtocol";

import {
  type CanvasObjectIdType,
} from '@/types/CanvasObjectModel';

import {
  type ClientSummary,
} from '@/types/ClientSummary';

import {
  setActiveUsers,
} from '@/store/activeUsers/activeUsersSlice';

import {
  setCursorPosByClient,
  unsetCursorPosByClient,
} from '@/store/activeUsers/cursorPositionsByActiveUserSlice';

import {
  setSelectorsByCanvasObject as reducerSetSelectorsByCanvasObject,
  removeSelectorsByCanvasObject as reducerRemoveSelectorsByCanvasObject,
  removeCanvasObjectsBySelector as reducerRemoveCanvasObjectsBySelector,
} from '@/store/activeUsers/selectorsByCanvasObjectSlice';

import {
  removeCurrentEditors,
} from '@/store/activeUsers/currentEditorsByCanvasSlice';

import {
  addActiveUsersByWhiteboard as addActiveUsersByWhiteboardReducer,
  setActiveUsersByWhiteboard as setActiveUsersByWhiteboardReducer,
  removeActiveUsers as removeActiveUsersReducer,
} from '@/store/activeUsers/activeUsersByWhiteboardSlice';

export const addActiveUsersByWhiteboard = (
  dispatch: AppDispatch,
  whiteboardId: WhiteboardIdType,
  clientSummaries: ClientSummary[],
) => {
  dispatch(setActiveUsers(clientSummaries));
  dispatch(addActiveUsersByWhiteboardReducer({
    [whiteboardId]: clientSummaries.map(clientSummary => clientSummary.clientId),
  }));
};

export const setActiveUsersByWhiteboard = (
  dispatch: AppDispatch,
  whiteboardId: WhiteboardIdType,
  clientSummaries: ClientSummary[],
) => {
  dispatch(setActiveUsers(clientSummaries));
  dispatch(setActiveUsersByWhiteboardReducer({
    [whiteboardId]: clientSummaries.map(clientSummary => clientSummary.clientId)
  }));
};

export const removeActiveUsers = (
  dispatch: AppDispatch,
  userClientIds: ClientIdType[]
) => {
  dispatch(removeActiveUsersReducer(userClientIds));
  dispatch(unsetCursorPosByClient(userClientIds));
  dispatch(reducerRemoveCanvasObjectsBySelector(userClientIds));
  dispatch(removeCurrentEditors(userClientIds));
};

export const setSelectorsByCanvasObject = (
  dispatch: AppDispatch,
  selectorsByCanvasObject: Record<CanvasObjectIdType, ClientIdType>,
) => {
  dispatch(reducerSetSelectorsByCanvasObject(selectorsByCanvasObject));
};

export const removeSelectorsByCanvasObject = (
  dispatch: AppDispatch,
  objectIds: CanvasObjectIdType[],
) => {
  dispatch(reducerRemoveSelectorsByCanvasObject(objectIds));
};

export const removeCanvasObjectsBySelector = (
  dispatch: AppDispatch,
  selectors: ClientIdType[],
) => {
  dispatch(reducerRemoveCanvasObjectsBySelector(selectors));
};

export const setClientCursorPos = (
  dispatch: AppDispatch,
  clientId: ClientIdType,
  x: number,
  y: number,
) => {
  dispatch(setCursorPosByClient({
    [clientId]: { x, y },
  }));
};

export const unsetClientCursorPos = (
  dispatch: AppDispatch,
  clientId: ClientIdType,
) => {
  dispatch(unsetCursorPosByClient([clientId]));
};
