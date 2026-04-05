import {
  useState,
  createContext,
  type ReactNode,
} from 'react';

import {
  type User,
} from '@/types/APIProtocol';

import type {
  AuthContextType,
} from '@/types/UserAuth';

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const LS_KEY_USER = 'user';
const LS_KEY_AUTH_TOKEN = 'token';

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>((): User | null => {
    const val = localStorage.getItem(LS_KEY_USER);

    if (! val) {
      return null;
    } else {
      return JSON.parse(val);
    }
  });

  // -- store auth token (jwt) here, as a mirror/interface to localStorage
  const [authToken, setAuthToken] = useState<string | null>(
    (): string | null => localStorage.getItem(LS_KEY_AUTH_TOKEN) || null
  );

  const isSetAuthTokenFunction = (setter: Parameters<typeof setAuthToken>[0])
    : setter is (prevState: string | null) => string | null => {
    return (typeof setter === 'function');
  };

  // sets value in localStorage simultaneously
  const setAuthTokenWrapper = (setter: Parameters<typeof setAuthToken>[0]) => {
    if (isSetAuthTokenFunction(setter)) {
      setAuthToken((oldAuthToken) => {
        const value = setter(oldAuthToken);

        if (! value) {
          localStorage.removeItem(LS_KEY_AUTH_TOKEN);
        } else {
          localStorage.setItem(LS_KEY_AUTH_TOKEN, value);
        }
        console.log('!! NEW AUTH TOKEN (func):', value);// TODO: remove debug

        return value;
      });
    } else {
      const value = setter;

      if (value === null) {
        localStorage.removeItem(LS_KEY_AUTH_TOKEN);
      } else {
        localStorage.setItem(LS_KEY_AUTH_TOKEN, value);
      }

      console.log('!! NEW AUTH TOKEN (value):', value);// TODO: remove debug
      setAuthToken(value);
    }
  };// -- end setAuthTokenWrapper

  const isSetUserFunction = (setter: Parameters<typeof setUser>[0])
    : setter is (prevState: User | null) => User | null => {
    return (typeof setter === 'function');
  };

  // sets value in localStorage simultaneously
  const setUserWrapper = (setter: Parameters<typeof setUser>[0]) => {
    if (isSetUserFunction(setter)) {
      setUser((oldUser) => {
        const value = setter(oldUser);

        if (! value) {
          localStorage.removeItem(LS_KEY_USER);
        } else {
          localStorage.setItem(LS_KEY_USER, JSON.stringify(value));
        }

        console.log('!! NEW USER (func):', value);// TODO: remove debug
        return value;
      });
    } else {
      const value = setter;

      if (value === null) {
        localStorage.removeItem(LS_KEY_USER);
      } else {
        localStorage.setItem(LS_KEY_USER, JSON.stringify(value));
      }

      console.log('!! NEW USER (value):', value);// TODO: remove debug
      setUser(value);
    }
  };// -- end setUserWrapper

  return (
    <AuthContext.Provider value={{
      user,
      setUser: setUserWrapper,
      authToken,
      setAuthToken: setAuthTokenWrapper,
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export default AuthContext;
