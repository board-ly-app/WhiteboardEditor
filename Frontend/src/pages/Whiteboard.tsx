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

import {
  type AxiosError,
} from 'axios';

import {
  useQuery,
  useQueryClient
} from '@tanstack/react-query';

import {
  ChevronDown,
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
  type UserPermissionEnum,
  type UserPermission,
  type ErrorResponse as APIErrorResponse,
} from '@/types/APIProtocol';

// -- program state
import {
  store,
  type RootState,
} from '@/store';

import {
  setSelectedCanvasObjects,
} from '@/controllers';

import {
  ClientMessengerContext,
} from '@/context/ClientMessengerContext';

import {
  selectActiveUsersByWhiteboard,
} from '@/store/activeUsers/activeUsersSelectors';

import {
  selectWhiteboardById
} from '@/store/whiteboards/whiteboardsSelectors';

import {
  selectCanvasesWithObjectsByWhiteboardId,
} from '@/store/canvases/canvasesSelectors';

import {
  selectCanvasObjectsByWhiteboard,
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
  type NewCanvasDimensions,
} from '@/types/CreateCanvas';

import type {
  ClientIdType,
  ClientMessageCreateCanvas,
  CanvasData,
  CanvasIdType,
  WhiteboardIdType,
  WhiteboardAttribs,
  UserSummary,
} from '@/types/WebSocketProtocol';

import {
  type OperationDispatcher,
} from '@/types/OperationDispatcher';

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

type ComponentStatus = 
  | { status: 'ready'; }
  | { status: 'pending'; }
  | { status: 'error'; error: AxiosError; }
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
    ownPermission,
    currentTool,
    setCurrentTool,
  } = whiteboardContext;

  const {
    clientMessenger,
  } = clientMessengerContext;

  // -- prop-derived state
  const whiteboardKey = ['whiteboard', whiteboardId];

  // -- managed state
  const {
    isLoading: isWhiteboardLoading,
    isFetching: isWhiteboardFetching,
    error: whiteboardError,
  } = query;
  const whiteboardIdRef = useRef<WhiteboardIdType>(whiteboardId);

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

  // dirty trick to keep whiteboardIdRef in-sync with whiteboardId
  useEffect(() => {
    whiteboardIdRef.current = whiteboardId;
  }, [whiteboardId]);

  const [shapeAttributesState, dispatchShapeAttributes] = useReducer(shapeAttributesReducer, {
    x: 0,
    y: 0,
    rotation: 0,
    fillColor: '#999999',
    strokeColor: '#000000',
    strokeWidth: 1,
    fontSize: 20,
    color: '#000000',
  });

  const activeUsers : Record<ClientIdType, UserSummary> = useSelector((state: RootState) => (
    selectActiveUsersByWhiteboard(state, whiteboardId)
  )) || {};

  const currWhiteboard: WhiteboardAttribs | null = useSelector((state: RootState) => (
    selectWhiteboardById(state, whiteboardId))
  );

  console.log('Current Whiteboard:', currWhiteboard);

  const canvases: CanvasData[] = useSelector((state: RootState) => {
    console.log('Current State:', state);
    return selectCanvasesWithObjectsByWhiteboardId(state, whiteboardId)
  });

  const childCanvasesByCanvas : Record<CanvasIdType, CanvasIdType[]> = useSelector(
    (state: RootState) => state['childCanvasesByCanvas']
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

  const [newCanvasDimensions, setNewCanvasDimensions] = useState<NewCanvasDimensions | null>(null);
  const [newCanvasParentId, setNewCanvasParentId] = useState<CanvasIdType | null>(null);

  // Used within Toolbar
  const handleToolChange = useCallback(
    (choice : ToolChoice) => {
      setSelectedCanvasObjects(dispatch, []);
      setCurrentTool(choice);
    },
    [dispatch, setCurrentTool]
  );

  // Send delete canvas objects message when the delete key is pressed
  const selectedCanvasObjects : CanvasObjectIdType[] = useSelector(
    (state: RootState) => selectSelectedCanvasObjectsByWhiteboard(state, whiteboardId)
  );

  useEffect(
    () => {
      const handleKeyDown = (ev: KeyboardEvent) => {
        ev.preventDefault();
        console.log('!! KEYDOWN:', ev.key);

        switch (ev.key) {
          case 'Delete':
          case 'Backspace':
            clientMessenger?.sendDeleteCanvasObjects({
              type: 'delete_canvas_objects',
              canvasObjectIds: selectedCanvasObjects,
            });
            break;
        }
      };

      window.addEventListener('keydown', handleKeyDown);

      return () => window.removeEventListener('keydown', handleKeyDown);
    },
    [clientMessenger, selectedCanvasObjects]
  );

  // -- derived state
  let status : ComponentStatus;

  if (whiteboardError) {
    if (whiteboardError.status === 403) {
      // -- Redirect to login on receipt of 403 error
      if (whiteboardError && whiteboardError.status === 403) {
        const redirectUrl : string = encodeURIComponent(`${location.pathname}${location.search}`);

        navigate(`/login?redirect=${redirectUrl}`);
      }
    }

    status = { status: 'error', error: whiteboardError };
  } else if (isWhiteboardLoading || isWhiteboardFetching || (! currWhiteboard)) {
    status = { status: 'pending' };
  } else {
    status = { status: 'ready' };
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
      const canvasesById : Record<CanvasIdType, CanvasData> = Object.fromEntries(canvases.map(
        canvasData => [ canvasData.id, canvasData ]
      ));
      
      const rootCanvasId = currWhiteboard.rootCanvas;
      
      const canvasesSorted = [...canvases];
      
      canvasesSorted.sort((a, b) => new Date(a.timeCreated) < new Date(b.timeCreated) ? -1 : 1);
      
      const title = currWhiteboard.name;
      
      // --- misc functions
      const handleCreateCanvasDimensions = (parentCanvasId: CanvasIdType, dimensions: NewCanvasDimensions) => {
          setNewCanvasDimensions(dimensions);
          setNewCanvasParentId(parentCanvasId);
          openCreateCanvasModal();
      };

      const handleNewCanvas = (canvas: NewCanvas) => {
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
      };
      
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
      
      const pageTitle = `${title} | ${APP_NAME}`;

      const ActiveUsersHeaderDropdown = () => (
        // TODO: Abstract out a generic dropdown menu
        // Active Users
        <DropdownMenu key="active-users">
          <DropdownMenuTrigger className="text-header-button-text group flex items-center gap-1 px-4 py-2 rounded-lg hover:cursor-pointer hover:text-header-button-text-hover whitespace-nowrap">
            Active Users
            <ChevronDown className="w-4 h-4 transition-transform duration-300 group-data-[state=open]:rotate-180"/>
          </DropdownMenuTrigger>
          <DropdownMenuContent>
            <div className="flex flex-col">
              {Object.values(activeUsers).map((u) => (
                <DropdownMenuLabel key={u.clientId}>
                  {u.username}
                </DropdownMenuLabel>
              ))}
            </div>
          </DropdownMenuContent>
        </DropdownMenu>
      );

      return (
        <Page
          title={pageTitle}
        >
          <main>
            {/* Header */}
            <HeaderAuthed 
              title={title}
              zIndex={10}
              toolbarElemsLeft={[
                <ShareWhiteboardButton />,
              ]}
              toolbarElemsRight={[
                <ActiveUsersHeaderDropdown />,
              ]}
              noMarginTop={true}
            />
      
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
                    toolChoice={currentTool}
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
                    currentTool={currentTool}
                    canvasesById={canvasesById}
                    childCanvasesByCanvas={childCanvasesByCanvas}
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

                      console.log('User permissions update submitted successfully');

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
  const [newCanvasAllowedUsers, setNewCanvasAllowedUsers] = useState<string[]>([]);
  const [currentDispatcher, setCurrentDispatcher] = useState<OperationDispatcher | null>(null);
  const [selectedCanvasId, setSelectedCanvasId] = useState<CanvasIdType | null>(null);
  const [tooltipText, setTooltipText] = useState<string>("");
  const [editingText, setEditingText] = useState<string>("");

  if (! authContext) {
    throw new Error('AuthContext not provided to Whiteboard');
  }

  const {
    user,
  } = authContext;

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
        `/whiteboards/${whiteboardId}`
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

  const {
    data: whiteboardData,
  } = query;

  console.log("Current whiteboard data:", whiteboardData);

  // update the state of userPermissions whenever whiteboardData changes
  const [userPermissions, setSharedUsers] = useState<APIWhiteboard['user_permissions']>([]);
  console.log("Current shared users:", userPermissions);

  // -- view/edit/own - determines which actions to enable or disable
  const [ownPermission, setOwnPermission] = useState<UserPermissionEnum | null>(null);

  useEffect(() => {
    if (whiteboardData && user) {
      const newOwnPermission = whiteboardData.user_permissions
        .find(
          (perm: UserPermission) => perm.type === 'user' && perm.user.id === user.id
        ) || null;

      setSharedUsers(whiteboardData.user_permissions);
      
      if (newOwnPermission) {
        setOwnPermission(newOwnPermission.permission);
      }
      else {
        setOwnPermission(null);
      }
    }
  }, [whiteboardData, user])

  const canvasObjectsByCanvas: Record<CanvasIdType, Record<CanvasObjectIdType, CanvasObjectModel>> = useSelector((state: RootState) => (
    selectCanvasObjectsByWhiteboard(state, whiteboardId)
  ));

  console.log("canvasObjects: ", canvasObjectsByCanvas);

  // Current tool choice will be saved to localStorage to ensure seamless UX
  // after page reloads.
  // TODO: save default tool choice ('hand') in a separate config file.
  // const [currentTool, setCurrentTool] = useState<ToolChoice>('hand');
  const LS_CURRENT_TOOL_KEY = 'current_tool';
  const CURRENT_TOOL_DEFAULT : ToolChoice = 'hand'

  const [currentTool, setCurrentTool] = useState<ToolChoice>((): ToolChoice => {
    const savedTool : string | null = localStorage.getItem(LS_CURRENT_TOOL_KEY);

    if (! savedTool) {
      // return default choice
      return CURRENT_TOOL_DEFAULT;
    } else {
      // just trust that the retrieved tool is a valid tool
      return savedTool as ToolChoice;
    }
  });

  // -- make sure to save to localStorage whenever current tool changes
  useEffect(
    () => {
      localStorage.setItem(LS_CURRENT_TOOL_KEY, currentTool);
    },
    [currentTool]
  );

  // -- track refs to canvas groups (frames)
  const canvasGroupRefsByIdRef: RefObject<Record<CanvasIdType, RefObject<Konva.Group | null>>> = useRef({});

  // -- transform canvas object diffs into full updated shapes
  const handleUpdateShapes = useCallback(
    (canvasId: CanvasIdType, shapes: Record<CanvasObjectIdType, Partial<CanvasObjectModel>>) => {
      if (clientMessenger) {
        // find relevant objects and merge the new attributes into the existing
        // attributes
        const canvasObjects: Record<CanvasObjectIdType, CanvasObjectModel> | null = canvasObjectsByCanvas[canvasId] || null;

        if (! canvasObjects) {
          console.error('No canvas objects on canvas id', canvasId);
          return;
        }

        const changedObjects: Record<CanvasObjectIdType, CanvasObjectModel> = {};

        for (const [objId, objUpdate] of Object.entries(shapes)) {
          const existingShape = canvasObjects[objId];

          if (!existingShape) continue;

          if (objId in canvasObjects) {
            console.log("updated shape is in canvas objects"); // debug
            changedObjects[objId] = {
              ...canvasObjects[objId],
              ...(objUpdate as Partial<typeof existingShape>),
            } as CanvasObjectModel;
          }
        }// end for (const [objId, objUpdate] of Object.entries(shapes))

        clientMessenger.sendUpdateShapes({
          type: 'update_shapes',
          canvasId,
          shapes: changedObjects
        });
      }
    },
    [canvasObjectsByCanvas, clientMessenger]
  );

  return (
    <WhiteboardProvider
      handleUpdateShapes={handleUpdateShapes}
      currentTool={currentTool}
      setCurrentTool={setCurrentTool}
      whiteboardId={whiteboardId}
      userPermissions={userPermissions}
      setSharedUsers={setSharedUsers}
      newCanvasAllowedUsers={newCanvasAllowedUsers}
      setNewCanvasAllowedUsers={setNewCanvasAllowedUsers}
      ownPermission={ownPermission}
      setOwnPermission={setOwnPermission}
      currentDispatcher={currentDispatcher}
      setCurrentDispatcher={setCurrentDispatcher}
      selectedCanvasId={selectedCanvasId}
      setSelectedCanvasId={setSelectedCanvasId}
      canvasGroupRefsByIdRef={canvasGroupRefsByIdRef}
      tooltipText={tooltipText}
      setTooltipText={setTooltipText}
      editingText={editingText}
      setEditingText={setEditingText}
    >
      <Whiteboard
        query={query}
      />
    </WhiteboardProvider>
  );
};// end WrappedWhiteboard

export default WrappedWhiteboard;
