import type {
  Dispatch,
  SetStateAction,
} from 'react';

import {
  type User,
} from '@/types/APIProtocol';

export interface AuthContextType {
  user: User | null;
  setUser: Dispatch<SetStateAction<User | null>>;
  authToken: string | null;
  setAuthToken: Dispatch<SetStateAction<string | null>>;
}
