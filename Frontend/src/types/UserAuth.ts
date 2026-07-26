import {
  type User,
} from '@/types/User';

export interface AuthContextType {
  user: User | null;
  getSessionToken: () => string | null;
  handleLogin: (authedUser: User, sessionToken?: string) => unknown;
  handleLogout: () => Promise<void>;
}
