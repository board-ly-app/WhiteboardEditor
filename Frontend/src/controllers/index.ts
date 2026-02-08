// re-import constituent functions

import {
  setCanvasObjects,
  removeCanvasObjects,
  setSelectedCanvasObjects,
  removeSelectedCanvasObjects,
} from './canvasObjects';

import {
  addCanvas,
  deleteCanvas,
} from './canvases';

import {
  addWhiteboard,
} from './whiteboards';

import {
  addActiveUsersByWhiteboard,
  setActiveUsersByWhiteboard,
  removeActiveUsers,
} from './activeUsers';

import {
  setCurrentEditorsByCanvas,
  removeCurrentEditorsByCanvas,
} from './currentEditors';

export {
  setCanvasObjects,
  removeCanvasObjects,
  setSelectedCanvasObjects,
  removeSelectedCanvasObjects,
  addCanvas,
  deleteCanvas,
  setCurrentEditorsByCanvas,
  removeCurrentEditorsByCanvas,
  addWhiteboard,
  addActiveUsersByWhiteboard,
  setActiveUsersByWhiteboard,
  removeActiveUsers,
};
