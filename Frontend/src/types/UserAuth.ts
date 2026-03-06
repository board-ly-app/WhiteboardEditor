import type {
  Dispatch,
  SetStateAction,
} from 'react';

export interface User {
  id: string;
  username: string;
  email: string;
  kind: string;
}

export interface AuthContextType {
  user: User | null;
  setUser: Dispatch<SetStateAction<User | null>>;
  authToken: string | null;
  setAuthToken: Dispatch<SetStateAction<string | null>>;
}
