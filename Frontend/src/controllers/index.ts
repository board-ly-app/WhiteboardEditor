// re-import constituent functions

import {
  setClientId,
  unsetClientId
} from './client';

import {
  setCanvasObjects,
  removeCanvasObjects,
} from './canvasObjects';

import {
  addCanvas,
  deleteCanvas,
  mergeCanvas,
  setSelectedCanvasByWhiteboard,
} from './canvases';

import {
  addWhiteboard,
  deleteWhiteboard,
  setWhiteboardStatus,
} from './whiteboards';

import {
  addActiveUsersByWhiteboard,
  setActiveUsersByWhiteboard,
  removeActiveUsers,
  setSelectorsByCanvasObject,
  removeSelectorsByCanvasObject,
  removeCanvasObjectsBySelector,
  setClientCursorPos,
} from './activeUsers';

import {
  setCurrentEditorsByCanvas,
  removeCurrentEditorsByCanvas,
} from './currentCanvasEditors';

export {
  setClientId,
  unsetClientId,
  setClientCursorPos,
  setCanvasObjects,
  removeCanvasObjects,
  addCanvas,
  deleteCanvas,
  mergeCanvas,
  setCurrentEditorsByCanvas,
  removeCurrentEditorsByCanvas,
  setSelectedCanvasByWhiteboard,
  addWhiteboard,
  deleteWhiteboard,
  setWhiteboardStatus,
  addActiveUsersByWhiteboard,
  setActiveUsersByWhiteboard,
  removeActiveUsers,
  setSelectorsByCanvasObject,
  removeSelectorsByCanvasObject,
  removeCanvasObjectsBySelector,
};
