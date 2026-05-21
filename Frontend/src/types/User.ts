// === User.ts =================================================================
//
// Defines the user type, which is utilized by both the API protocol and the
// Web Socket protocol.
//
// =============================================================================

interface UserBase {
  id: string;
  username: string;
}

export interface PermanentUser extends UserBase {
  kind: 'permanent';
  email: string;
}

export interface TempUser extends UserBase {
  kind: 'temp';
  createdAt: Date;
}

export type User =
  | PermanentUser
  | TempUser
;

