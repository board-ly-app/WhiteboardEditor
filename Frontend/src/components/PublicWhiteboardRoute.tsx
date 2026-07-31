import { useContext, useEffect, useState } from 'react';
import type { PropsWithChildren } from 'react';
import { Navigate, useLocation, useParams } from 'react-router-dom';

import {
  isAxiosError,
} from 'axios';

import {
  toast,
} from 'react-toastify';

import AuthContext from '@/context/AuthContext';
import api from '@/api/axios';

type AccessStatus = 'checking' | 'allowed' | 'redirect_login';

const PublicWhiteboardRoute = ({ children }: PropsWithChildren): React.JSX.Element | null => {
  const authContext = useContext(AuthContext);

  const { whiteboard_id: whiteboardId } = useParams<{ whiteboard_id: string }>();
  if (! whiteboardId) throw new Error('No whiteboard_id provided by path parameters');

  const location = useLocation();

  if (! authContext) throw new Error('No auth context provided');

  const {
    user,
    handleLogin,
  } = authContext;

  const [status, setStatus] = useState<AccessStatus>(user?.kind === 'permanent' ? 'allowed' : 'checking');

  useEffect(() => {
    if (user?.kind === 'permanent') {
      setStatus('allowed');
      return;
    }

    api.get(`/whiteboards/id/${encodeURIComponent(whiteboardId)}`)
      .then(async (res) => {
        const wb = res.data;

        switch (wb.visibility) {
          case 'public':
          {
            // -- Just make a temp user, if no user already
            if (! user) {
              try {
                const userResp = await api.post('/users/temp');
                handleLogin(userResp.data.user, userResp.data.sessionToken);
                setStatus('allowed');
              } catch (e: unknown) {
                if (isAxiosError(e)) {
                  if (! e.response) {
                    console.error('Could not receive /users/temp response from server');
                    toast.error('Error creating temp user');
                  } else {
                    console.error('Creating temp user failed with status', e.response.status);
                    toast.error('Unable to create temporary user');
                    setStatus('redirect_login');
                  }
                } else {
                  console.error('Could not create temp user:', e);
                  toast.error('Error creating temp user');
                }
              }
            } else {
              setStatus('allowed');
            }
          }
          break;
          case 'private':
          {
            // -- Provisionally allow; delegate authentication to inner
            // Whiteboard page
            setStatus('allowed');
          }
          break;
          default:
            throw new Error(`Unexpected whiteboard visibility: ${wb.visibility}`);
        }// -- end switch (wb.visibility)
      })
      .catch(() => {
        toast.error('Failed to retrieve whiteboard information');
        setStatus('redirect_login');
      });
    },
    [whiteboardId, user, handleLogin]
  );// -- end init useEffect

  switch (status) {
    case 'checking':
      return null;
    case 'redirect_login':
    {
      const locationEncoded = encodeURIComponent(`${location.pathname}${location.search}`);
      return <Navigate to={`/login?redirect=${locationEncoded}`} replace />;
    }
    case 'allowed':
      return <>{children}</>;
  }// -- end switch (status)
};// -- end PublicWhiteboardRoute

export default PublicWhiteboardRoute;
