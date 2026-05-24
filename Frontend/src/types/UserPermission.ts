// === UserPermission.ts =======================================================
//
// Defines the UserPermission type utilized by both the API protocol and the Web
// Socket protocol.
//
// =============================================================================

import {
  type User,
} from '@/types/User';

// === UserPermissionEnum ======================================================
//
// Specifies the permissions a user can have on a whiteboard.
//
// - view: only view the whiteboard
// - edit: view and make edits to the canvases within the whiteboard
// - own: view ane edit the whiteboard, as well as change user permissions and
// change metadata such as the whiteboard name.
//
// =============================================================================
export type UserPermissionEnum = 
  | 'view'
  | 'edit'
  | 'own'
;

export const USER_PERMISSION_TYPES : UserPermissionEnum[] = [
  'view',
  'edit',
  'own'
];

export interface UserPermissionByUser {
  type: 'user';
  user: User;
  email?: string;
  permission: UserPermissionEnum;
}

export interface UserPermissionByEmail {
  type: 'email';
  email: string;
  permission: UserPermissionEnum;
}

// === UserPermission ==========================================================
//
// Specifies the permissions a user has on a given whiteboard. The permissions
// are. Permissions may be specified by either user id or email address. Email
// address permissions need not correspond to an existing user account; this
// permission will be attached to an account by user id when an account with the
// given email address is created.
//
// =============================================================================
export type UserPermission =
  | UserPermissionByUser
  | UserPermissionByEmail
;
