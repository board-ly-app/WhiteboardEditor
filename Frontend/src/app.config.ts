// === app.config.ts ===========================================================
//
// Contains runtime constants that need to be accessed by multiple components.
//
// =============================================================================

// -- Human-readable app name to be displayed to users.
export const APP_NAME = "Boardly";

// -- Number of milliseconds until "current editor" canvas notification should
// expire after the user's last edit to the canvas.
export const CURRENT_EDITOR_NUM_MILLIS = 5000;

// -- Key used to identify whether a Konva node is a UI-only element that
// shouldn't appear in exported images.
export const KONVA_NODE_UI_ONLY_KEY = 'is_ui_element';

// -- Color used to indicate the user's client when interacting with objects in
// the whiteboard (i.e. selected shapes, canvases).
export const USER_CLIENT_COLOR = '#44ff44';

// -- Default colors assigned to clients other than the user themself.
export const DEFAULT_CLIENT_COLORS = [
  'red',
  'blue',
  'orange',
  'magenta',
  'pink',
  'purple',
  'green',
];

// -- Number of milliseconds to display a notification when a whiteboard is
// deleted, before redirecting the user to their dashboard.
export const WHITEBOARD_DELETED_NOTIFICATION_NUM_MILLIS = 5000;

// -- Number of active users to display outside dropdown menu on Whiteboard page
// header.
export const ACTIVE_USERS_DISPLAY_LIMIT = 3;

// -- Milliseconds to wait between throttled function execuations
export const THROTTLE_INTERVAL = 100;

// -- Number of collaborators to display on whiteboard card
export const WB_CARD_COLLABORATORS_DISPLAY_LIMIT = 3;

// -- Max title character lenght
export const MAX_TITLE_LENGTH = 64;

// -- Name of current copied canvas object in localStorage
export const LS_KEY_COPIED_CANVAS_OBJECT = 'copied_canvas_object';
