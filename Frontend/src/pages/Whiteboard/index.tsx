// -- std imports
import {
  useState,
  useRef,
  useEffect,
  useReducer,
  useContext,
  useCallback,
  type RefObject,
} from 'react';

import {
  useParams,
  useLocation,
  useNavigate,
  Link,
} from 'react-router-dom';

import {
  useSelector,
} from 'react-redux';

// -- third-party imports

import lodash from 'lodash';

import {
  type AxiosError,
} from 'axios';

import {
  useQuery,
  useQueryClient
} from '@tanstack/react-query';

import {
  X,
} from 'lucide-react';

import Konva from 'konva';

import {
  Bounce,
  toast,
} from 'react-toastify';

import {
  type AxiosResponse as AxiosResp,
} from 'axios';

// -- local types
import {
  APP_NAME,
} from '@/app.config';

import {
  axiosResponseIsError,
  type Whiteboard as APIWhiteboard,
  type ErrorResponse as APIErrorResponse,
} from '@/types/APIProtocol';

import {
  type Notification,
} from '@/types/Notification';

// -- program state
import {
  store,
  type RootState,
} from '@/store';

import {
  ClientMessengerContext,
} from '@/context/ClientMessengerContext';

import {
  selectWhiteboardById,
  selectWhiteboardStatus,
  selectWhiteboardPermissionByUser,
} from '@/store/whiteboards/whiteboardsSelectors';

import {
  selectSelectedCanvasObjectsByWhiteboard,
} from '@/store/canvasObjects/canvasObjectsSelectors';

import WhiteboardContext, {
  WhiteboardProvider,
} from "@/context/WhiteboardContext";

import AuthContext from '@/context/AuthContext';

import api from '@/api/axios';

import { useModal } from '@/components/Modal';

import Page from '@/components/Page';
import CanvasCard from "@/components/CanvasCard";
import Sidebar from "@/components/Sidebar";
import Toolbar from "@/components/Toolbar";
import ShapeAttributesMenu from "@/components/ShapeAttributesMenu";
import DeleteShapesButton from '@/components/DeleteShapeButton';
import HeaderButton from '@/components/HeaderButton';
import HeaderAuthed from '@/components/HeaderAuthed';
import shapeAttributesReducer from '@/reducers/shapeAttributesReducer';
import type { ToolChoice } from '@/components/Tool';

// -- page-specific components
import {
  NotificationsHeaderMenu,
} from '@/pages/Whiteboard/NotificationsHeaderMenu';

// -- ui components
import {
  ActiveUsersHeaderDropdown,
} from '@/components/ActiveUsersHeaderDropdown';

import type {
  CanvasObjectIdType,
  CanvasObjectModel,
} from '@/types/CanvasObjectModel';

import ShareWhiteboardForm, {
  type ShareWhiteboardFormData
} from '@/components/ShareWhiteboardForm';

import CreateCanvasMenu, {
  type NewCanvas,
} from '@/components/CreateCanvasMenu'

import {
  DeleteWhiteboardForm,
} from '@/components/DeleteWhiteboardForm';

import {
  type NewCanvasDimensions,
} from '@/types/CreateCanvas';

import type {
  ClientMessageCreateCanvas,
  CanvasIdType,
  WhiteboardIdType,
} from '@/types/WebSocketProtocol';

import {
  type WhiteboardState,
} from '@/types/Store';

import {
  type OperationDispatcher,
} from '@/types/OperationDispatcher';

import HeaderUnauthed from '@/components/HeaderUnauthed';
import { useUser } from '@/hooks/useUser';

import {
  removeSelectorsByCanvasObject,
  updateWhiteboard,
  setNotifications,
} from '@/controllers';

type ComponentStatus = 
  | {
    status: 'ready';
    currWhiteboard: Pick<WhiteboardState, 'name' | 'rootCanvas'>;
  }
  | { status: 'pending'; }
  | { status: 'error'; error: AxiosError; }
  | {
    status: 'deleting';
    currWhiteboard: Pick<WhiteboardState, 'name' | 'rootCanvas'>;
  }
  | { status: 'deleted'; }
;

type WhiteboardQueryType = ReturnType<typeof useQuery<APIWhiteboard, AxiosError>>;

// -- only for inner whiteboard, not wrapper, which is the default export
interface WhiteboardProps {
  query: WhiteboardQueryType;
}

const Whiteboard = ({
  query,
}: WhiteboardProps) => {
  const location = useLocation();
  const navigate = useNavigate();
  const { user } = useUser();

  if (!user) {
    throw new Error('No authenticated user found');
  }

  const dispatch = store.dispatch;

  // -- references
  const whiteboardContext = useContext(WhiteboardContext);
  const authContext = useContext(AuthContext);
  const clientMessengerContext = useContext(ClientMessengerContext);
  const queryClient = useQueryClient();

  if (! whiteboardContext) {
    throw new Error('No WhiteboardContext provided to Whiteboard');
  }

  if (! authContext) {
    throw new Error('No AuthContext provided to Whiteboard');
  }

  if (! clientMessengerContext) {
    throw new Error('No ClientMessengerContext provided to Whiteboard');
  }

  const {
    whiteboardId,
    userPermissions,
  } = whiteboardContext;

  const {
    clientMessenger,
  } = clientMessengerContext;

  const ownPermission = useSelector(
    (state: RootState) => selectWhiteboardPermissionByUser(state, whiteboardId, user.id),
    lodash.isEqual
  );

  // -- prop-derived state
  const whiteboardKey = ['whiteboard', whiteboardId];

  // -- managed state
  const {
    isLoading: isWhiteboardLoading,
    isFetching: isWhiteboardFetching,
    error: whiteboardError,
  } = query;

  // -- fetch unread notifications
  useEffect(
    () => {
      api.get('/notifications')
        .then((res) => {
          const notifications : Notification[] = res.data.notifications;

          setNotifications(dispatch, Object.fromEntries(
            notifications.map(notif => [notif.id, notif])
          ));
        })
        .catch((e: unknown) => {
          console.error('Could not fetch notifications:', e);
        });
    },
    [dispatch]
  );

  // alert user of any errors fetching whiteboard
  useEffect(
    () => {
      if (whiteboardError && whiteboardError.status !== 403) {
        console.error('Error fetching whiteboard', whiteboardId, ':', whiteboardError);
        toast.error(`Error fetching whiteboard: ${whiteboardError}`, {
          position: "bottom-center",
          hideProgressBar: true,
          closeOnClick: true,
          pauseOnHover: true,
          draggable: true,
          progress: undefined,
          theme: "colored",
          transition: Bounce,
        });
      }
    }, [whiteboardError, whiteboardId]
  );

  const [shapeAttributesState, dispatchShapeAttributes] = useReducer(shapeAttributesReducer, {
    x: 0,
    y: 0,
    rotation: 0,
    fillColor: '#ec8e41',
    strokeColor: '#000000',
    strokeWidth: 1,
    fontSize: 20,
    color: '#000000',
  });

  const name : string | null = useSelector(
    (state: RootState) => selectWhiteboardById(state, whiteboardId)?.name ?? null,
    lodash.isEqual
  );

  const rootCanvas : string | null = useSelector(
    (state: RootState) => selectWhiteboardById(state, whiteboardId)?.rootCanvas ?? null,
    lodash.isEqual
  );

  const currentTool : ToolChoice | null = useSelector(
    (state: RootState) => selectWhiteboardById(state, whiteboardId)?.currentTool ?? null,
    lodash.isEqual
  );

  // Current tool choice will be saved to localStorage to ensure seamless UX
  // after page reloads.
  // TODO: save default tool choice ('hand') in a separate config file.
  // const [currentTool, setCurrentTool] = useState<ToolChoice>('hand');
  const LS_CURRENT_TOOL_KEY = 'current_tool';

  // -- Reload previous current tool on page refresh
  useEffect(
    () => {
      const savedTool : ToolChoice | null = localStorage.getItem(LS_CURRENT_TOOL_KEY) as ToolChoice | null;

      if (savedTool) {
        updateWhiteboard(dispatch, whiteboardId, {
          currentTool: savedTool,
        });
      }
    },
    [dispatch, whiteboardId]
  );

  // -- make sure to save to localStorage whenever current tool changes
  useEffect(
    () => {
      if (currentTool) {
        localStorage.setItem(LS_CURRENT_TOOL_KEY, currentTool);
      }
    },
    [currentTool]
  );

  const selectedCanvasObjects : CanvasObjectIdType[] = useSelector(
    (state: RootState) => selectSelectedCanvasObjectsByWhiteboard(
      state, whiteboardId, user.id
    ),
    lodash.isEqual
  );

  const {
    Modal: ShareModal,
    openModal: openShareModal,
    closeModal: closeShareModal
  } = useModal();

  const {
    Modal: CreateCanvasModal,
    openModal: openCreateCanvasModal,
    closeModal: closeCreateCanvasModal,
  } = useModal();

  const {
    Modal: DeleteWhiteboardModal,
    openModal: openDeleteWhiteboardModal,
    closeModal: closeDeleteWhiteboardModal,
  } = useModal();

  const [newCanvasDimensions, setNewCanvasDimensions] = useState<NewCanvasDimensions | null>(null);
  const [newCanvasParentId, setNewCanvasParentId] = useState<CanvasIdType | null>(null);

  // Used within Toolbar
  const handleToolChange = useCallback(
    (choice : ToolChoice) => {
      updateWhiteboard(dispatch, whiteboardId, {
        currentTool: choice,
      });

      for (const objId of selectedCanvasObjects) {
        clientMessenger?.sendUnselectedCanvasObject({
          type: 'unselected_canvas_object',
          canvasObjectId: objId,
        });
      }// -- end for objId

      removeSelectorsByCanvasObject(dispatch, selectedCanvasObjects);
    },
    [dispatch, selectedCanvasObjects, clientMessenger, whiteboardId]
  );

  const whiteboardStatus = useSelector(
    (state: RootState) => selectWhiteboardStatus(state, whiteboardId),
    lodash.isEqual
  );

  // -- display alert if whiteboard enters deleting status
  useEffect(
    () => {
      switch (whiteboardStatus) {
        case 'deleting':
        {
          toast.warning('Whiteboard has been deleted', {
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
        break;
        case 'deleted':
        {
            // -- redirect to dashboard
            navigate('/dashboard');
        }
        break;
        default:
          // -- nothing to do in particular
      }// -- end switch whiteboardStatus
    },
    [whiteboardStatus, navigate]
  );

  // -- miscellaneous callback functions
  const handleSubmitDeleteWhiteboard = useCallback(
    async () => {
      try {
        await api.delete(`/whiteboards/${whiteboardId}`);

        toast.success(`Whiteboard ${whiteboardId} deleted successfully`, {
          position: "bottom-center",
          hideProgressBar: true,
          closeOnClick: true,
          pauseOnHover: true,
          draggable: true,
          progress: undefined,
          theme: "colored",
          transition: Bounce,
        });
      } catch (err: unknown) {
        const e = err as AxiosError;
        
        console.error(`FAILED TO DELETE WHITEBOARD (${e.code}): ${JSON.stringify(e.response, null, 2)}`);
        toast.error(`Error fetching whiteboard: ${e}`, {
          position: "bottom-center",
          hideProgressBar: true,
          closeOnClick: true,
          pauseOnHover: true,
          draggable: true,
          progress: undefined,
          theme: "colored",
          transition: Bounce,
        });
        
        // -- propagate error
        throw err;
      } finally {
        closeDeleteWhiteboardModal();
      }
    },
    [closeDeleteWhiteboardModal, whiteboardId]
  );// -- end handleSubmitDeleteWhiteboard

  // -- derived state
      
  // --- misc functions
  const handleCreateCanvasDimensions = useCallback(
    (parentCanvasId: CanvasIdType, dimensions: NewCanvasDimensions) => {
        setNewCanvasDimensions(dimensions);
        setNewCanvasParentId(parentCanvasId);
        openCreateCanvasModal();
    },
    [setNewCanvasDimensions, openCreateCanvasModal]
  );

  const handleNewCanvas = useCallback(
    (canvas: NewCanvas) => {
      // Send message to server.
      // Server will echo response back, and actually inserting the new canvas
      // will be handled by handleServerMessage.
      // TODO: allow setting custom canvas sizes
      if (clientMessenger && newCanvasParentId && newCanvasDimensions) {
        const createCanvasMsg : ClientMessageCreateCanvas = ({
          type: 'create_canvas',
          width: newCanvasDimensions.width,
          height: newCanvasDimensions.height,
          name: canvas.canvasName,
          parentCanvas: {
            canvasId: newCanvasParentId,
            originX: newCanvasDimensions.originX,
            originY: newCanvasDimensions.originY,
          },
          allowedUsers: canvas.allowedUsers,
        });
    
        clientMessenger.sendCreateCanvas(createCanvasMsg);
        setNewCanvasParentId(null);
        setNewCanvasDimensions(null);
      }
    },
    [
      clientMessenger,
      newCanvasDimensions,
      newCanvasParentId,
      setNewCanvasParentId,
      setNewCanvasDimensions,
    ]
  );

  let status : ComponentStatus;

  if (whiteboardError) {
    if (whiteboardError.status === 403) {
      // -- Redirect to login on receipt of 403 error
      if (whiteboardError && whiteboardError.status === 403) {
        const redirectUrl : string = encodeURIComponent(`${location.pathname}${location.search}`);

        navigate(`/login?redirect=${redirectUrl}`);
        return null;
      }
    }

    status = { status: 'error', error: whiteboardError };
  } else if (
    isWhiteboardLoading
      || isWhiteboardFetching
      || (! name)
      || (! rootCanvas)
  ) {
    status = { status: 'pending' };
  } else if (whiteboardStatus === 'deleting') {
    status = {
      status: 'deleting',
      currWhiteboard: {
        name,
        rootCanvas,
      },
    };
  } else if (whiteboardStatus === 'deleted') {
    status = { status: 'deleted' };
  } else {
    status = {
      status: 'ready',
      currWhiteboard: {
        name,
        rootCanvas,
      },
    };
  }

  switch (status.status) {
    case 'pending':
    {
        const isActive = !!clientMessenger;

        return (
          <Page
            title="Loading ..."
          >
            <main>
              {/* Header */}
              <HeaderAuthed 
                title="Loading ..."
                zIndex={10}
              />
              {
                /** Display if socket not connected **/
                (! isActive) && (
                  <p className="text-lg font-bold text-red-600">
                    Connecting ...
                  </p>
                )
              }
            </main>
          </Page>
        );
    }
    case 'error':
    {
        const {
          error,
        } = status;

        switch (error.status) {
          case 403:
          case 404:
            // -- indicate that the given resource either doesn't exist or can't
            // be accessed
            return (
              <Page
                title="Whiteboard Not Found"
              >
                <main>
                  {/* Header */}
                  <HeaderAuthed 
                    title="Not Found"
                    zIndex={10}
                  />

                  <div className="flex flex-col items-center gap-8 w-full px-16">
                    <p className="text-center text-3xl font-normal">
                      Either the requested whiteboard doesn't exist or you don't have permission to access it.
                    </p>

                    <Link
                      to="/dashboard"
                      className="w-64 rounded-md bg-blue-400 text-center text-xl"
                    >
                      Back to Dashboard
                    </Link>
                  </div>
                </main>
              </Page>
            );
          default:
            // -- generic error message
            return (
              <Page
                title="Error Loading Whiteboard"
              >
                <main>
                  {/* Header */}
                  <HeaderAuthed 
                    title="Error Loading Whiteboard"
                    zIndex={10}
                  />

                  <p className="text-xl font-semibold font-red">
                    Error: {error.toString()}
                  </p>
                </main>
              </Page>
            );
        }// -- end switch error.status
    }
    case 'ready':
    {
      const {
        currWhiteboard,
      } = status;
      
      const {
        name: title,
        rootCanvas: rootCanvasId,
      } = currWhiteboard;
      
      // -- Header elements
      const ShareWhiteboardButton = () => (
        <HeaderButton 
          onClick={() => {
            openShareModal();
          }}
          title="Share"
          disabled={ownPermission !== 'own'}
        /> 
      );

      // Delete whiteboard button (only if the user is an owner)
      const DeleteWhiteboardButton = () => (
        <HeaderButton
          onClick={openDeleteWhiteboardModal}
          title="Delete"
          disabled={ownPermission !== 'own'}
        />
      );
      
      const pageTitle = `${title} | ${APP_NAME}`;

      return (
        <Page
          title={pageTitle}
        >
          <main>
            {/* Header - permanent or temp */}
            {user.kind === 'permanent' ? <>
              <HeaderAuthed 
                title={title}
                zIndex={10}
                toolbarElemsLeft={[
                  ((ownPermission === 'own') && <ShareWhiteboardButton />),
                  ((ownPermission === 'own') && <DeleteWhiteboardButton />),
                  <NotificationsHeaderMenu />,
                ]}
                toolbarElemsRight={[
                  <ActiveUsersHeaderDropdown />,
                ]}
                noMarginTop={true}
              />
            </>
            : <>
              <HeaderUnauthed
                title={title}
                toolbarElemsLeft={[
                  (
                    <HeaderButton 
                      to={"/login"}
                      title="Home"
                    />
                  ),
                ]}
                toolbarElemsRight={[
                  <ActiveUsersHeaderDropdown />,
                ]}
                noMarginTop={true}
              />
            </>}
      
            {/* Content */}
            <div className="">
              {/**
                Left-hand sidebar for toolbar and menus
                Not displayed in view-only mode.
              **/
              }
              {(ownPermission && (ownPermission !== 'view')) && (
                <Sidebar
                  side="left"
                  zIndex={10}
                >
                  {/* Toolbar */}
                  <Toolbar
                    onToolChange={handleToolChange}
                  />
      
                  {/** Shape Attributes Menu **/}
                  <ShapeAttributesMenu
                    attributes={shapeAttributesState}
                    dispatch={dispatchShapeAttributes}
                  />
                  <DeleteShapesButton />
                </Sidebar>
              )}
      
              {/* Canvas Container */}
              <div className="flex flex-col justify-center flex-wrap">
                
                {/** Misc. info **/}
                <div className="fixed top-20 left-2 right-0 z-50 flex flex-col justify-center flex-wrap">
                  {/** Indicate if the user is in view-only mode **/}
                  {(ownPermission && (ownPermission === 'view')) && (
                    <div>
                      <span>
                        <strong
                          className="text-xl font-bold"
                        >
                          You are in view-only mode
                        </strong>
                      </span>
                    </div>
                  )}
                </div>
      
                {/* Display Canvases */}
                <div className="flex flex-1 flex-row justify-center flex-wrap">
                  <CanvasCard
                    whiteboardId={whiteboardId}
                    rootCanvasId={rootCanvasId}
                    shapeAttributes={shapeAttributesState}
                    onSelectCanvasDimensions={handleCreateCanvasDimensions}
                  />
                </div>
              </div>
            </div>
      
            {/** Modal that opens to share the whiteboard **/}
            <ShareModal zIndex={20}>
              <div className="flex flex-col">
                <div
                  className="flex flex-row justify-end"
                >
                  <button
                    onClick={closeShareModal}
                    className="hover:cursor-pointer"
                  >
                    <X />
                  </button>
                </div>
      
                <ShareWhiteboardForm
                  initUserPermissions={userPermissions || []}
                  onSubmit={async (data: ShareWhiteboardFormData) => {
                    try {
                      const {
                        userPermissions
                      } = data;
      
                      const userPermissionsFinal = userPermissions.map(perm => {
                        if (perm.type === 'user') {
                          if ((typeof perm.user) === 'object') {
                            // extract object id
                            return ({
                              ...perm,
                              user: perm.user.id
                            });
                          } else {
                            // already object id
                            return perm;
                          }
                        } else {
                          return perm;
                        }
                      });

                      // -- make sure we have at least one owner
                      if (! userPermissionsFinal.find(perm => perm.permission === 'own')) {
                        // -- display popup alert
                        toast.error('Whiteboard must have at least one owner.', {
                          position: "bottom-center",
                          hideProgressBar: true,
                          closeOnClick: true,
                          pauseOnHover: true,
                          draggable: true,
                          progress: undefined,
                          theme: "colored",
                          transition: Bounce,
                        });

                        return;
                      }
      
                      // No need for AxiosResp<..> type check, as response body
                      // isn't used.
                      await api.post(`/whiteboards/${whiteboardId}/user_permissions`, ({
                        userPermissions: userPermissionsFinal
                      }));

                      // -- display popup alert
                      toast.success('User permissions updated successfully', {
                        position: "bottom-center",
                        autoClose: 5000,
                        hideProgressBar: false,
                        closeOnClick: true,
                        pauseOnHover: true,
                        draggable: true,
                        progress: undefined,
                        theme: "colored",
                        transition: Bounce,
                      });

                      queryClient.invalidateQueries({
                        queryKey: whiteboardKey
                      });

                      closeShareModal();
                    } catch (err: unknown) {
                        const axiosErr = err as AxiosError<{ error: string; }>;

                        console.error('POST /whiteboards/:id/user_permissions failed:', axiosErr);

                        // -- display popup alert
                        toast.error(`Share request failed: ${axiosErr.response?.data.error}`, {
                          position: "bottom-center",
                          hideProgressBar: true,
                          closeOnClick: true,
                          pauseOnHover: true,
                          draggable: true,
                          progress: undefined,
                          theme: "colored",
                          transition: Bounce,
                        });

                        // -- propagate error to caller
                        throw err;
                    }
                  }}
                />
              </div>
            </ShareModal>
      
            {/** Create Canvas Modal **/}
            <CreateCanvasModal
              zIndex={20}
              className="p-4 rounded-sm"
            >
              <CreateCanvasMenu 
                onCreate={(canvas) => {
                  handleNewCanvas(canvas);
                  closeCreateCanvasModal();
                }}
                onCancel={closeCreateCanvasModal}
              />
            </CreateCanvasModal>

            {/** Delete Whiteboard Modal **/}
            <DeleteWhiteboardModal
              zIndex={20}
              className="p-4 rounded-sm"
            >
                <DeleteWhiteboardForm
                  whiteboardId={whiteboardId}
                  onSubmit={handleSubmitDeleteWhiteboard}
                  onCancel={closeDeleteWhiteboardModal}
                />
            </DeleteWhiteboardModal>
          </main>
        </Page>
      );
    }
    case 'deleting':
    {
      // -- keep displaying the whiteboard, with a gray overlay to indicate to
      // indicate that editing is disabled.
      // Assume a toast notification has already been created.
      const {
        currWhiteboard,
      } = status;

      const {
        rootCanvas: rootCanvasId,
      } = currWhiteboard;
      
      const title = `[DELETED] ${currWhiteboard.name}`;
      
      // --- misc functions
      const handleCreateCanvasDimensions = (_parentCanvasId: CanvasIdType, _dimensions: NewCanvasDimensions) => {
          // do nothing; functionality disabled
      };

      const pageTitle = `${title} | ${APP_NAME}`;

      return (
        <Page
          title={pageTitle}
        >
          <main>
            {/* Header */}
            <HeaderAuthed 
              title={title}
              zIndex={10}
              noMarginTop={true}
            />
      
            {/* Content */}
            <div className="">
              {/** Gray overlay **/}
              <div
                className="absolute z-5 w-full h-full bg-black opacity-60"
              >
              </div>
            
              {/* Canvas Container */}
              <div className="flex flex-col justify-center flex-wrap">
                
                {/** Misc. info **/}
                <div className="fixed top-20 left-2 right-0 z-50 flex flex-col justify-center flex-wrap">
                  {/** Indicate if the user is in view-only mode **/}
                  {(ownPermission && (ownPermission === 'view')) && (
                    <div>
                      <span>
                        <strong
                          className="text-xl font-bold"
                        >
                          You are in view-only mode
                        </strong>
                      </span>
                    </div>
                  )}
                </div>
      
                {/* Display Canvases */}
                <div className="flex flex-1 flex-row justify-center flex-wrap">
                  <CanvasCard
                    whiteboardId={whiteboardId}
                    rootCanvasId={rootCanvasId}
                    shapeAttributes={shapeAttributesState}
                    onSelectCanvasDimensions={handleCreateCanvasDimensions}
                  />
                </div>
              </div>
            </div>
          </main>
        </Page>
      );
    }
    case 'deleted':
    {
        // Just display a plain authed header 
        const pageTitle = `Whiteboard Deleted | ${APP_NAME}`;

        return (
          <Page
            title={pageTitle}
          >
            <main>
              {/* Header */}
              <HeaderAuthed 
                title="Whiteboard Deleted"
                zIndex={10}
                noMarginTop={true}
              />
        
              {/* Content */}
              <div className="">
                {/** Gray overlay **/}
                <div
                  className="absolute z-5 w-full h-full bg-black opacity-60"
                >
                </div>
              </div>
            </main>
          </Page>
        );
    }
    default:
      throw new Error(`Unrecognized component status: ${status}`);
  };
};// end Whiteboard

const WrappedWhiteboard = () => {
  const authContext = useContext(AuthContext);
  const clientMessengerContext = useContext(ClientMessengerContext);

  if (! authContext) {
    throw new Error('AuthContext not provided to Whiteboard');
  }

  if (! clientMessengerContext) {
    throw new Error('ClientMessengerContext not provided to Whiteboard');
  }

  const {
    clientMessenger,
  } = clientMessengerContext;

  const {
    whiteboard_id: whiteboardId
  } = useParams<WhiteboardIdType>();

  if (! whiteboardId) {
    throw new Error("No whiteboard ID provided to Whiteboard page");
  }

  const whiteboardKey = ['whiteboard', whiteboardId];

  const query = useQuery<APIWhiteboard, AxiosError>({
    queryKey: whiteboardKey,
    queryFn: async (): Promise<APIWhiteboard> => {
      const res : AxiosResp<APIWhiteboard> | AxiosResp<APIErrorResponse> = await api.get(
        `/whiteboards/id/${whiteboardId}`
      );

      if (axiosResponseIsError(res)) {
        throw res;
      } else {
        // success
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

  // update the state of userPermissions whenever whiteboardData changes
  const [userPermissions, setSharedUsers] = useState<APIWhiteboard['user_permissions']>([]);

  // -- track refs to canvas groups (frames)
  const canvasGroupRefsByIdRef: RefObject<Record<CanvasIdType, RefObject<Konva.Group | null>>> = useRef({});

  const currentDispatcherRef = useRef<OperationDispatcher | null>(null);

  // -- transform canvas object diffs into full updated shapes
  const handleUpdateShapes = useCallback(
    (
      canvasId: CanvasIdType,
      canvasObjectsById: Record<CanvasObjectIdType, CanvasObjectModel>,
      updates: Record<CanvasObjectIdType, Partial<CanvasObjectModel>>
    ) => {
      if (clientMessenger) {
        // find relevant objects and merge the new attributes into the existing
        // attributes
        const changedObjects: Record<CanvasObjectIdType, CanvasObjectModel> = {};

        for (const [objId, objUpdate] of Object.entries(updates)) {
          const existingShape = canvasObjectsById[objId];

          if (! existingShape) {
            continue;
          }

          if (objId in canvasObjectsById) {
            changedObjects[objId] = {
              ...canvasObjectsById[objId],
              ...(objUpdate as Partial<typeof existingShape>),
            } as CanvasObjectModel;
          }
        }// end for (const [objId, objUpdate] of Object.entries(shapes))

        clientMessenger.sendUpdateCanvasObjects({
          type: 'update_canvas_objects',
          canvasId,
          canvasObjects: changedObjects
        });
      }
    },
    [clientMessenger]
  );

  return (
    <WhiteboardProvider
      handleUpdateShapes={handleUpdateShapes}
      whiteboardId={whiteboardId}
      userPermissions={userPermissions}
      setSharedUsers={setSharedUsers}
      currentDispatcherRef={currentDispatcherRef}
      canvasGroupRefsByIdRef={canvasGroupRefsByIdRef}
    >
      <Whiteboard
        query={query}
      />
    </WhiteboardProvider>
  );
};// end WrappedWhiteboard

export default WrappedWhiteboard;
