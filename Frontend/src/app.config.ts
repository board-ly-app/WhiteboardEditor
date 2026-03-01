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

// -- Number of milliseconds to display a notification when a whiteboard is
// deleted, before redirecting the user to their dashboard.
export const WHITEBOARD_DELETED_NOTIFICATION_NUM_MILLIS = 5000;
