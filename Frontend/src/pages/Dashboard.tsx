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
import {
  type User,
} from '@/types/User';
import {
  useUser,
} from "@/hooks/useUser";
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

        // -- propagate error to caller
        throw err;
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
        <div className="grid grid-flow-col grid-rows-3 sm:grid-rows-2 lg:grid-rows-1 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mx-12 mb-8">
          <div className='col-span-1 order-2 lg:order-1 flex justify-center sm:justify-start'>
            <CreateWhiteboardModal
              onSubmit={handleCreateWhiteboard}
            />
          </div>
          <h1 className="col-span-2 text-2xl lg:text-4xl text-h1-text order-1 lg:order-2 text-center truncate">
            Welcome Back, {user.username}!
          </h1>
          <div className="col-span-1 flex flex-nowrap order-3 flex justify-center sm:justify-end">
            {/* TODO: This is just a placeholder for now, need to implement search and sort features */}
            <label htmlFor="search" className='hidden'>Search</label>
            <input name='search' className='text-nowrap hidden' value='' type='text' placeholder='Search me' />
            <button className='text-nowrap hidden'>Sort me</button>
          </div>
        </div>

        <div className='grid grid-cols-2 flex flex-col md:flex-row'>
          <div className="flex flex-col">
            <h1 className="flex items-center gap-4 pt-2 mb-4 mx-8 text-center text-2xl text-h2-text font-bold after:flex-1 after:h-px after:bg-border after:content-['']">
              Your Whiteboards
            </h1>
            <div className="flex-1 flex-col md:border-r-1 border-border px-4">
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
          </div>

          <div className="flex flex-col">
            <h1 className="flex items-center gap-4 pt-2 mb-4 mx-8 text-center text-2xl text-h2-text font-bold after:flex-1 after:h-px after:bg-border after:content-['']">
              Shared Whiteboards
            </h1>
            <div className="flex-1 flex-col px-4">
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
        </div>
      </main>

      <Footer />
    </Page>
  );
};// end Dashboard

export default Dashboard;
