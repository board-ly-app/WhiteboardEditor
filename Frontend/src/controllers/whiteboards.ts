import {
  DEFAULT_WB_ZOOM,
  MIN_WB_ZOOM,
  MAX_WB_ZOOM,
} from '@/app.config';

import {
  type AppDispatch,
  type RootState,
  store,
} from '@/store';

import type {
  WhiteboardIdType,
  WhiteboardData,
} from '@/types/WebSocketProtocol';

import {
  type WhiteboardState,
  type ZoomFocusEnum,
} from '@/types/Store';

import {
  setCanvasObjects,
} from '@/store/canvasObjects/canvasObjectsSlice';

import {
  setObjectsByCanvas,
} from '@/store/canvasObjects/canvasObjectsByCanvasSlice';

import {
  setChildCanvasesByCanvas,
} from '@/store/canvases/childCanvasesByCanvasSlice';

import {
  setCanvases,
} from '@/store/canvases/canvasesSlice';

import {
  setCanvasesByWhiteboard,
} from '@/store/canvases/canvasesByWhiteboardSlice';

import {
  setAllowedUsersByCanvas,
} from '@/store/allowedUsers/allowedUsersByCanvasSlice';

import {
  normalizeWhiteboard,
} from '@/store/whiteboards/whiteboardsNormalizers';

import {
  setWhiteboards,
  updateWhiteboardsById,
} from '@/store/whiteboards/whiteboardsSlice';

import {
  setWhiteboardStatuses,
  type WhiteboardStatusEnum,
} from '@/store/whiteboards/whiteboardStatusSlice';

import {
  deleteWhiteboardsAction,
} from '@/store/whiteboards/deleteWhiteboardsReducer';

export const addWhiteboard = (
  dispatch: AppDispatch,
  whiteboard: WhiteboardData
) => {
  const {
    whiteboards,
    canvases,
    childCanvasesByCanvas,
    canvasesByWhiteboard,
    canvasObjects,
    canvasObjectsByCanvas,
    allowedUsersByCanvas,
  } = normalizeWhiteboard(whiteboard);

  // -- add default whiteboard settings
  dispatch(setWhiteboards(Object.fromEntries(Object.entries(whiteboards).map(
    ([wid, attribs]) => [
      wid, {
        ...attribs,
        currentZoom: DEFAULT_WB_ZOOM,
        currentZoomFocus: 'center',
        currentTool: "hand",
        tooltipText: "",
        editingText: "",
      }
    ]
  ))));
  dispatch(setCanvases(canvases));
  dispatch(setCanvasObjects(canvasObjects));
  dispatch(setChildCanvasesByCanvas(childCanvasesByCanvas));
  dispatch(setObjectsByCanvas(canvasObjectsByCanvas));
  dispatch(setCanvasesByWhiteboard(canvasesByWhiteboard));
  dispatch(setAllowedUsersByCanvas(allowedUsersByCanvas));

  // set all new whiteboards to active status
  dispatch(setWhiteboardStatuses(
    Object.fromEntries(Object.keys(whiteboards).map(wid => [wid, 'active']))
  ));
};

export const deleteWhiteboard = (
  dispatch: AppDispatch,
  whiteboardId: WhiteboardIdType,
) => {
  // Recall, relations flow as follows:
  //  Whiteboard  => Canvas             => CurrentEditor
  //                                    => AllowedUser
  //                                    => ChildCanvas
  //                                    => CanvasObject
  //              => ActiveUser
  //              => WhiteboardStatus

  // -- First, set status to deleted to get whiteboard editor to display
  // notification
  dispatch(setWhiteboardStatuses({ [whiteboardId]: 'deleted' }));

  // -- Then, call custom reducer on root state to recursively delete all related data
  dispatch(deleteWhiteboardsAction([whiteboardId]));
};// -- end deleteWhiteboard

export const setWhiteboardStatus = (
  dispatch: AppDispatch,
  whiteboardId: WhiteboardIdType,
  status: WhiteboardStatusEnum,
) => {
  dispatch(setWhiteboardStatuses({ [whiteboardId]: status }));
};

export const updateWhiteboard = (
  dispatch: AppDispatch,
  whiteboardId: WhiteboardIdType,
  update: Partial<WhiteboardState>,
) => {
  dispatch(updateWhiteboardsById({ [whiteboardId]: update }));
};// -- end updateWhiteboard

export const scaleWhiteboardZoom = (
  whiteboardId: WhiteboardIdType,
  zoomMultiplier: number,
  focus: ZoomFocusEnum,
) => {
  const currState : RootState = store.getState();

  if (! (whiteboardId in currState.whiteboards)) return;

  const currentZoom = currState.whiteboards[whiteboardId].currentZoom;

  let nextZoom = currentZoom * zoomMultiplier;

  if (nextZoom < MIN_WB_ZOOM) {
    nextZoom = MIN_WB_ZOOM;
  } else if (nextZoom > MAX_WB_ZOOM) {
    nextZoom = MAX_WB_ZOOM;
  }

  store.dispatch(updateWhiteboardsById({
    [whiteboardId]: {
      currentZoom: nextZoom,
      currentZoomFocus: focus,
    },
  }));
};// -- end scaleWhiteboardZoom
