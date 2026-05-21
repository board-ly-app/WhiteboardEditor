import type {
  Dispatch,
  SetStateAction,
} from 'react';

import {
  type User,
} from '@/types/User';

export interface AuthContextType {
  user: User | null;
  setUser: Dispatch<SetStateAction<User | null>>;
  authToken: string | null;
  setAuthToken: Dispatch<SetStateAction<string | null>>;
}
