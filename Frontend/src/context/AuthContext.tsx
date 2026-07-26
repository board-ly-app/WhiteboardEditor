import {
  type ReactNode,
  useState,
  useEffect,
  useRef,
  useCallback,
  createContext,
} from 'react';

import {
  useNavigate,
} from 'react-router';

import {
  toast,
} from 'react-toastify';

import {
  LS_KEY_SESSION_TOKEN,
  REFRESH_ACCESS_TOKEN_QUERY_SECS,
} from '@/app.config';

import api from '@/api/axios';

import {
  type User,
} from '@/types/User';

import type {
  AuthContextType,
} from '@/types/UserAuth';

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const LS_KEY_USER = 'user';
const LS_KEY_IS_AUTHED = 'is_authed';

const LS_VAL_IS_AUTHED_TRUE = 'true';
const LS_VAL_IS_AUTHED_FALSE = 'false';

interface AuthProviderProps {
  children: ReactNode;
}

export const AuthProvider = ({
  children,
}: AuthProviderProps) => {
  const navigate = useNavigate();

  const refreshAccessTokenIntervalRef = useRef<number | null>(null);

  const [user, setUser] = useState<User | null>((): User | null => {
    const val = localStorage.getItem(LS_KEY_USER);

    if (! val) {
      return null;
    } else {
      return JSON.parse(val);
    }
  });

  const initIsAuthed : boolean = (() => {
    const isAuthedVal = localStorage.getItem(LS_KEY_IS_AUTHED);

    return isAuthedVal === LS_VAL_IS_AUTHED_TRUE;
  })();
  const isAuthedRef = useRef<boolean>(initIsAuthed);

  const handleRefreshAccessToken = useCallback(
    () => {
      api.post('/auth/refresh')
        .catch((_e: unknown) => {
          console.error('Access token refresh failed');
          // -- Unset isAuthed state
          isAuthedRef.current = false;
          localStorage.setItem(LS_KEY_IS_AUTHED, LS_VAL_IS_AUTHED_FALSE);

          // -- Finally, redirect to login page
          const location = window.location;
          const locationEncoded : string = encodeURIComponent(`${location.pathname}${location.search}`);

          navigate(`/login?redirect=${locationEncoded}`);
        });
    },
    [navigate]
  );// -- end handleRefreshAccessToken

  const isSetUserFunction = (setter: Parameters<typeof setUser>[0])
    : setter is (prevState: User | null) => User | null => {
    return (typeof setter === 'function');
  };

  // sets value in localStorage simultaneously
  const setUserWrapper = useCallback(
    (setter: Parameters<typeof setUser>[0]) => {
      if (isSetUserFunction(setter)) {
        setUser((oldUser) => {
          const value = setter(oldUser);

          if (! value) {
            localStorage.removeItem(LS_KEY_USER);
          } else {
            localStorage.setItem(LS_KEY_USER, JSON.stringify(value));
          }

          return value;
        });
      } else {
        const value = setter;

        if (value === null) {
          localStorage.removeItem(LS_KEY_USER);
        } else {
          localStorage.setItem(LS_KEY_USER, JSON.stringify(value));
        }

        setUser(value);
      }
    },
    []
  );// -- end setUserWrapper

  const resetAccessTokenRefreshInterval = useCallback(
    () => {
      if (refreshAccessTokenIntervalRef.current !== null) {
        window.clearInterval(refreshAccessTokenIntervalRef.current);
      }

      refreshAccessTokenIntervalRef.current = window.setInterval(
        handleRefreshAccessToken, REFRESH_ACCESS_TOKEN_QUERY_SECS * 1_000
      );
    },
    [handleRefreshAccessToken]
  );// -- end resetAccessTokenRefreshInterval

  // -- Initialize access token refresh interval
  useEffect(
    () => {
      const isAuthedVal = localStorage.getItem(LS_KEY_IS_AUTHED);

      if (isAuthedVal === LS_VAL_IS_AUTHED_TRUE) {
        handleRefreshAccessToken();
        resetAccessTokenRefreshInterval();
      }
    },
    [handleRefreshAccessToken, setUserWrapper, resetAccessTokenRefreshInterval]
  );// -- end access token refresh interval

  const getSessionToken = useCallback(
    () => {
      return localStorage.getItem(LS_KEY_SESSION_TOKEN);
    },
    []
  );// -- end getSessionToken

  const handleLogin = useCallback(
    (authedUser: User, sessionToken?: string): void => {
      setUserWrapper(authedUser);
      isAuthedRef.current = true;
      if (sessionToken) localStorage.setItem(LS_KEY_SESSION_TOKEN, sessionToken);
      localStorage.setItem(LS_KEY_IS_AUTHED, LS_VAL_IS_AUTHED_TRUE);
      resetAccessTokenRefreshInterval();
    },
    [resetAccessTokenRefreshInterval, setUserWrapper]
  );// -- end handleLogin

  const handleLogout = useCallback(
    async (): Promise<void> => {
      setUserWrapper(null);
      isAuthedRef.current = false;
      localStorage.setItem(LS_KEY_IS_AUTHED, LS_VAL_IS_AUTHED_FALSE);
      localStorage.removeItem(LS_KEY_SESSION_TOKEN);

      if (refreshAccessTokenIntervalRef.current !== null) {
        window.clearInterval(refreshAccessTokenIntervalRef.current);
        refreshAccessTokenIntervalRef.current = null;
      }

      // -- Call api logout endpoint to remove token cookies
      await api.post('/auth/logout')
        .then(() => {
          console.log('Logout successful');
          toast.success("Successfully logged out");
        })
        .catch((_err: unknown) => {
          console.error('Error logging out');
          toast.error("Successfully logged out");
        });
    },
    [setUserWrapper]
  );

  return (
    <AuthContext.Provider value={{
      user,
      getSessionToken,
      handleLogin,
      handleLogout,
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export default AuthContext;
