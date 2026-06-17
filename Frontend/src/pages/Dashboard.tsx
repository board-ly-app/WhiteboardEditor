// -- std imports
import {
  useCallback,
  useState,
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
import { DropdownMenu, DropdownMenuContent, DropdownMenuLabel, DropdownMenuRadioGroup, DropdownMenuRadioItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Button } from '@/components/ui/button';
import { ArrowUpDown } from 'lucide-react';

const Dashboard = (): React.JSX.Element => {
  const navigate = useNavigate();
  const location = useLocation();
  const pageTitle = `Your Dashboard | ${APP_NAME}`;
  const user: User | null = useUser().user;
  const DEFAULT_SORT: SortOption = 'date-new';

  if (! user) {
    throw new Error('Dashboard page needs authenticated user');
  }

  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<SortOption>(DEFAULT_SORT);

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

  const handleSearchChange = (ev: React.ChangeEvent<HTMLInputElement>) => {
    setSearchQuery(ev.target.value);
  };

  // -- case-insensitive match of the search query against a whiteboard's name
  const normalizedQuery = searchQuery.trim().toLowerCase();
  const matchesSearch = (whiteboard: Whiteboard): boolean =>
    whiteboard.name.toLowerCase().includes(normalizedQuery);

  // -- redirect to login on 403 (forbidden)
  const locationEncoded : string = encodeURIComponent(`${location.pathname}${location.search}`);

  if (ownWhiteboardsError && ownWhiteboardsError.status === 403) {
    navigate(`/login?redirect=${locationEncoded}`);
  } else if (sharedWhiteboardsError && sharedWhiteboardsError.status === 403) {
    navigate(`/login?redirect=${locationEncoded}`);
  }

  // -- give owned or shared whiteboards more width based on counts.
  // NOTE: these must be full, static class strings so Tailwind's source scanner can find and generate them.
  let ownColClass = 'lg:col-span-3';
  let shareColClass = 'lg:col-span-3';
  if (ownWhiteboards && sharedWhiteboards) {
    if (ownWhiteboards.length > 1.5 * sharedWhiteboards.length) {
      ownColClass = 'lg:col-span-4';
      shareColClass = 'lg:col-span-2';
    } else if (sharedWhiteboards.length > 1.5 * ownWhiteboards.length) {
      ownColClass = 'lg:col-span-2';
      shareColClass = 'lg:col-span-4';
    }
  }

  type SortOption = 
    | 'name-a-z'
    | 'name-z-a'
    | 'date-new'
    | 'date-old'
  ;

  const getCreatedAt = (wb: Whiteboard): number => {
    const raw = wb.kind === 'temp_whiteboard' ? wb.createdAt : wb.time_created;
    return new Date(raw).getTime();
  };

  const sortWhiteboards = (
    whiteboards: Whiteboard[],
    sortBy: SortOption,
  ): Whiteboard[] => {
    const sorted = [...whiteboards];
    switch (sortBy) {
      case 'name-a-z': return sorted.sort((a, b) => a.name.localeCompare(b.name));
      case 'name-z-a': return sorted.sort((a, b) => b.name.localeCompare(a.name));
      case 'date-new': return sorted.sort((a, b) => getCreatedAt(b) - getCreatedAt(a));
      case 'date-old': return sorted.sort((a, b) => getCreatedAt(a) - getCreatedAt(b));
    }
  };

  const filteredOwnWhiteboards = 
    ownWhiteboards && sortWhiteboards(ownWhiteboards.filter(matchesSearch), sortBy);
  const filteredSharedWhiteboards = 
    sharedWhiteboards && sortWhiteboards(sharedWhiteboards.filter(matchesSearch), sortBy);

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
          <div className="col-span-1 flex flex-nowrap order-3 flex justify-center items-center sm:justify-end gap-4">
            <label htmlFor="search" className='hidden'>Search</label>
            <input
              name='search'
              className='text-nowrap px-4 py-2 border rounded-lg'
              value={searchQuery}
              type='text'
              placeholder='Search for whiteboard'
              onChange={handleSearchChange}
            />
            
            <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="outline"
                size="icon"
                aria-label="Sort whiteboards"
                title="Sort whiteboards"
                className="size-10"
              >
                <ArrowUpDown className="size-6" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuLabel>Sort by:</DropdownMenuLabel>
              <DropdownMenuRadioGroup
                value={sortBy}
                onValueChange={(value) => setSortBy(value as SortOption)}
              >
                <DropdownMenuRadioItem value="name-a-z">Name (A to Z)</DropdownMenuRadioItem>
                <DropdownMenuRadioItem value="name-z-a">Name (Z to A)</DropdownMenuRadioItem>
                <DropdownMenuRadioItem value="date-new">Date (newest first)</DropdownMenuRadioItem>
                <DropdownMenuRadioItem value="date-old">Date (oldest first)</DropdownMenuRadioItem>
                {/* TODO: need to implement modified times for whiteboards */}
              </DropdownMenuRadioGroup>
            </DropdownMenuContent>
          </DropdownMenu>
          </div>
        </div>

        <div className='grid grid-cols-3 md:grid-cols-6 flex flex-col md:flex-row'>
          <div className={"flex flex-col col-span-3 " + ownColClass}>
            <h1 className="flex items-center gap-4 pt-2 mb-1 ml-8 mr-4 text-center text-2xl text-h2-text font-bold after:flex-1 after:h-px after:bg-border after:content-['']">
              Your Whiteboards
            </h1>
            <div className="flex-1 flex-col md:border-r-1 border-border px-4 pt-4 pb-8">
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
                      whiteboardsAttribs={filteredOwnWhiteboards || []}
                    />
                  );
                }
              })()}
            </div>
          </div>

          <div className={"flex flex-col col-span-3 " + shareColClass}>
            <h1 className="flex items-center gap-4 pt-2 mb-1 ml-8 mr-4 text-center text-2xl text-h2-text font-bold after:flex-1 after:h-px after:bg-border after:content-['']">
              Shared Whiteboards
            </h1>
            <div className="flex-1 flex-col px-4 pt-4 pb-8">
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
                      whiteboardsAttribs={filteredSharedWhiteboards || []}
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
