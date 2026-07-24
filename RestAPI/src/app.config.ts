// === app.config.ts ===========================================================
//
// Misc. configuration constants to be shared across components.
//
// =============================================================================

// -- The current api version
export const API_VERSION = 'v1';

// -- Route paths
export const HEALTH_ROUTE = `/api/${API_VERSION}/health`;
export const AUTH_ROUTE = `/api/${API_VERSION}/auth`;
export const USERS_ROUTE = `/api/${API_VERSION}/users`;
export const WHITEBOARDS_ROUTE = `/api/${API_VERSION}/whiteboards`;
export const NOTIFICATIONS_ROUTE = `/api/${API_VERSION}/notifications`;

// -- Cookie ids
export const SESSION_ID_COOKIE_ID = 'session_id';
export const REFRESH_TOKEN_COOKIE_ID = 'refresh_token';
export const ACCESS_TOKEN_COOKIE_ID = 'access_token';

// -- Misc. custom header names
export const CSRF_TOKEN_HEADER = 'x-session-token';

