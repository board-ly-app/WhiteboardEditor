// -- std imports
import {
  useCallback,
} from 'react';

import {
  useNavigate,
  useLocation,
} from 'react-router-dom';

// -- third-party imports

import {
  useQuery,
  // useQueryClient,
} from '@tanstack/react-query';

import {
  Bounce,
  toast,
} from 'react-toastify';

// -- local imports

import {
  APP_NAME,
} from '@/app.config';

// -- api
import api from '@/api/axios';

import {
  type AxiosResponse,
  type AxiosError,
} from 'axios';

import {
  axiosResponseIsError,
  type Whiteboard,
  type ErrorResponse,
} from '@/types/APIProtocol';

import Page from '@/components/Page';

// -- components
import HeaderAuthed from "@/components/HeaderAuthed";
import { useUser } from "@/hooks/useUser";
import type { User } from "@/types/UserAuth";
import CreateWhiteboardModal, {
  type CreateWhiteboardFormData
} from '@/components/CreateWhiteboardModal';
import WhiteboardList from '@/components/WhiteboardList';
import Footer from '@/components/Footer';

const Dashboard = (): React.JSX.Element => {
  const navigate = useNavigate();
  const location = useLocation();
  const pageTitle = `Your Dashboard | ${APP_NAME}`;
  const user: User | null = useUser().user;

  if (! user) {
    throw new Error('Dashboard page needs authenticated user');
  }

  const {
    error: ownWhiteboardsError,
    isLoading: isOwnWhiteboardsLoading,
    isFetching: isOwnWhiteboardsFetching,
    data: ownWhiteboards,
  } = useQuery<Whiteboard[], AxiosError<ErrorResponse>>({
    queryKey: [user.id, 'dashboard', 'whiteboards', 'own'],
    queryFn: async () => {
      const res : AxiosResponse<Whiteboard[]> = await api.get('/whiteboards/own');

      return res.data;
    },
    retry: (failureCount, error) => {
      if (failureCount >= 3) {
        return false;
      } else {
        switch (error.status) {
          case 403:
          case 404:
            // -- We can be sure that the whiteboard either doesn't exist or we
            // don't have permission to access it.
            return false;
          default:
            return true;
        }// -- end switch error.
      }
    },
  });

  const {
    error: sharedWhiteboardsError,
    isLoading: isSharedWhiteboardsLoading,
    isFetching: isSharedWhiteboardsFetching,
    data: sharedWhiteboards,
  } = useQuery<Whiteboard[], AxiosError<ErrorResponse>>({
    queryKey: [user.id, 'dashboard', 'whiteboards', 'shared'],
    queryFn: async () => {
      const res : AxiosResponse<Whiteboard[]> = await api.get('/users/me/shared_whiteboards');

      if (axiosResponseIsError(res)) {
        throw res;
      } else {
        return res.data;
      }
    },
    retry: (failureCount, error) => {
      if (failureCount >= 3) {
        return false;
      } else {
        switch (error.status) {
          case 403:
          case 404:
            // -- We can be sure that the whiteboard either doesn't exist or we
            // don't have permission to access it.
            return false;
          default:
            return true;
        }// -- end switch error.
      }
    },
  });

  const handleCreateWhiteboard = useCallback(
    async (data: CreateWhiteboardFormData) => {
      try {
        const res : AxiosResponse<Whiteboard> = await api.post('/whiteboards', data);

        const {
          id,
        } = res.data;

        if (! id) {
          throw new Error('Received no Whiteboard ID from API response');
        }

        const redirectUrl = `/whiteboard/${id}`;

        navigate(redirectUrl);
      } catch (err: unknown) {
        const apiErr = err as AxiosError;

        console.error('Create whiteboard failed:', apiErr.message);

        if (apiErr.status === 403) {
          // -- redirect to login
          const locationEncoded : string = encodeURIComponent(`${location.pathname}${location.search}`);

          navigate(`/login?redirect=${locationEncoded}`);
        } else {
          toast.error(`Create whiteboard failed: ${apiErr.message}`, {
            position: "bottom-center",
            autoClose: 10000,
            hideProgressBar: false,
            closeOnClick: false,
            pauseOnHover: true,
            draggable: true,
            progress: undefined,
            theme: "colored",
            transition: Bounce,
          });
        }
      }
    },
    [navigate, location]
  );// -- end handleCreateWhiteboard

  // -- redirect to login on 403 (forbidden)
  const locationEncoded : string = encodeURIComponent(`${location.pathname}${location.search}`);

  if (ownWhiteboardsError && ownWhiteboardsError.status === 403) {
    navigate(`/login?redirect=${locationEncoded}`);
  } else if (sharedWhiteboardsError && sharedWhiteboardsError.status === 403) {
    navigate(`/login?redirect=${locationEncoded}`);
  }

  return (
    <Page
      title={pageTitle}
    >
      <HeaderAuthed
        title={APP_NAME}
      />

      <main>
        <h1 className="text-xl md:text-4xl text-h1-text text-center m-5">
          Welcome Back, {user.username}!
        </h1>

        <div className='text-center lg:text-left m-4 lg:ml-60 lg:mb-12'>
          <CreateWhiteboardModal
            onSubmit={handleCreateWhiteboard}
          />
        </div>

        <div className='flex flex-col md:flex-row border-t-1 border-border mx-24'>
          <div className="flex-1 flex-col md:border-r-1 border-border">
            <h1 className="pt-12 mb-8 text-center text-2xl text-h2-text font-bold">
              Your Whiteboards
            </h1>
            {(() => {
              if (ownWhiteboardsError) {
                return (
                  <WhiteboardList
                    status="error"
                    message={`${ownWhiteboardsError}`}
                  />
                );
              } else if (isOwnWhiteboardsLoading || isOwnWhiteboardsFetching) {
                return (<WhiteboardList status="loading" />);
              } else {
                return (
                  <WhiteboardList
                    status="ready"
                    whiteboardsAttribs={ownWhiteboards || []}
                  />
                );
              }
            })()}
          </div>

          <div className="flex-1 flex-col">
            <h1 className="pt-12 mb-8 text-center text-2xl text-h2-text font-bold">
              Shared Whiteboards
            </h1>
            {(() => {
              if (sharedWhiteboardsError) {
                return (
                  <WhiteboardList
                    status="error"
                    message={`${sharedWhiteboardsError}`}
                  />
                );
              } else if (isSharedWhiteboardsLoading || isSharedWhiteboardsFetching) {
                return (<WhiteboardList status="loading" />);
              } else {
                return (
                  <WhiteboardList
                    status="ready"
                    whiteboardsAttribs={sharedWhiteboards || []}
                  />
                );
              }
            })()}
          </div>
        </div>
      </main>

      <Footer />
    </Page>
  );
};// end Dashboard

export default Dashboard;
