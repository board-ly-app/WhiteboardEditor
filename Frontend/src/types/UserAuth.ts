import {
  type User,
} from '@/types/User';

export interface AuthContextType {
  user: User | null;
  handleLogin: (authedUser: User) => unknown;
  handleLogout: () => Promise<void>;
}
