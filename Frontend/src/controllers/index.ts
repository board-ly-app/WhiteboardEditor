// re-import constituent functions

import {
  setCanvasObjects,
  removeCanvasObjects,
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
  addCanvas,
  deleteCanvas,
  setCurrentEditorsByCanvas,
  removeCurrentEditorsByCanvas,
  addWhiteboard,
  addActiveUsersByWhiteboard,
  setActiveUsersByWhiteboard,
  removeActiveUsers,
};
