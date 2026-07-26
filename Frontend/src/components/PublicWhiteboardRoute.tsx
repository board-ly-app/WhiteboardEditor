import { useContext, useEffect, useState } from 'react';
import type { PropsWithChildren } from 'react';
import { Navigate, useLocation, useParams } from 'react-router-dom';

import AuthContext from '@/context/AuthContext';
import api from '@/api/axios';

type AccessStatus = 'checking' | 'allowed' | 'redirect_login';

const PublicWhiteboardRoute = ({ children }: PropsWithChildren): React.JSX.Element | null => {
  const authContext = useContext(AuthContext);
  const { whiteboard_id: whiteboardId } = useParams<{ whiteboard_id: string }>();
  const location = useLocation();

  if (!authContext) {
    throw new Error('No auth context provided');
  }

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

    api.get(`/whiteboards/id/${whiteboardId}`)
      .then(async (res) => {
        const wb = res.data;

        if (wb.visibility === 'public') {
          const alreadyHasAccess = user && wb.user_permissions.some(
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            (perm: any) => perm.type === 'user' && perm.user?.id === user.id
          );

          if (!alreadyHasAccess) {
            const userResp = await api.post('/users/temp');
            handleLogin(userResp.data.user, userResp.data.sessionToken);
          }

          setStatus('allowed');
        } else {
          setStatus('redirect_login');
        }
      })
      .catch(() => {
        setStatus('redirect_login');
      });
    },
    [whiteboardId, user, handleLogin]
  );// -- end init useEffect

  if (status === 'checking') {
    return null;
  }

  if (status === 'redirect_login') {
    const locationEncoded = encodeURIComponent(`${location.pathname}${location.search}`);
    return <Navigate to={`/login?redirect=${locationEncoded}`} replace />;
  }

  return <>{children}</>;
};

export default PublicWhiteboardRoute;
