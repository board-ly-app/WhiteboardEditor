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
  useNavigate,
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
  ZoomIn,
  ZoomOut,
} from 'lucide-react';

import Konva from 'konva';

import {
  Bounce,
  toast,
} from 'react-toastify';

// -- local types
import {
  APP_NAME,
  WB_ZOOM_FACTOR,
} from '@/app.config';

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


import Page from '@/components/Page';
import Sidebar from "@/components/Sidebar";
import HeaderButton from '@/components/HeaderButton';
import HeaderAuthed from '@/components/HeaderAuthed';
import shapeAttributesReducer from '@/reducers/shapeAttributesReducer';
import type { ToolChoice } from '@/components/Tool';

// -- page-specific components
import CanvasCard from "@/pages/Whiteboard/CanvasCard";
import Toolbar from "@/pages/Whiteboard/Toolbar";
import ShapeAttributesMenu from "@/pages/Whiteboard/ShapeAttributesMenu";
import DeleteShapesButton from '@/pages/Whiteboard/DeleteShapeButton';

import {
  NotificationsHeaderMenu,
} from '@/pages/Whiteboard/NotificationsHeaderMenu';

import {
  ShareWhiteboardForm,
} from '@/pages/Whiteboard/ShareWhiteboardForm'

// -- headless components
import {
  ActiveUsersHeaderDropdown,
} from '@/components/ActiveUsersHeaderDropdown';

import type {
  CanvasObjectIdType,
  CanvasObjectModel,
} from '@/types/CanvasObjectModel';

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
import {
  useUser,
} from '@/hooks/useUser';

import {
  removeSelectorsByCanvasObject,
  updateWhiteboard,
  setNotifications,
  scaleWhiteboardZoom,
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

const Whiteboard = () => {
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
  } = whiteboardContext;

  const {
    clientMessenger,
  } = clientMessengerContext;

  const ownPermission = useSelector(
    (state: RootState) => selectWhiteboardPermissionByUser(state, whiteboardId, user.id),
    lodash.isEqual
  );

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

  const [shapeAttributesState, dispatchShapeAttributes] = useReducer(shapeAttributesReducer, {
    x: 0,
    y: 0,
    rotation: 0,
    fillColor: '#ebf7ff',
    strokeColor: '#2782b0',
    strokeWidth: 1,
    fontSize: 20,
    color: '#003652',
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

  const [shareOpen, setShareOpen] = useState(false);
  const [createCanvasOpen, setCreateCanvasOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);

  const [newCanvasDimensions, setNewCanvasDimensions] = useState<NewCanvasDimensions | null>(null);
  const [newCanvasParentId, setNewCanvasParentId] = useState<CanvasIdType | null>(null);

  // Used within Toolbar
  const handleToolChange = useCallback(
    (choice : ToolChoice) => {
      updateWhiteboard(dispatch, whiteboardId, {
        currentTool: choice,
      });

      clientMessenger?.sendUnselectedCanvasObjects({
        type: 'unselected_canvas_objects',
        canvasObjectIds: selectedCanvasObjects,
      });

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
        setDeleteOpen(false);
      }
    },
    [setDeleteOpen, whiteboardId]
  );// -- end handleSubmitDeleteWhiteboard

  // -- derived state
      
  // --- misc functions
  const handleCreateCanvasDimensions = useCallback(
    (parentCanvasId: CanvasIdType, dimensions: NewCanvasDimensions) => {
        setNewCanvasDimensions(dimensions);
        setNewCanvasParentId(parentCanvasId);
        setCreateCanvasOpen(true);
    },
    [setNewCanvasDimensions, setCreateCanvasOpen]
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

  if ((! name) || (! rootCanvas)) {
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
            setShareOpen(true);
          }}
          title="Share"
          disabled={ownPermission !== 'own'}
        />
      );

      // Delete whiteboard button (only if the user is an owner)
      const DeleteWhiteboardButton = () => (
        <HeaderButton
          onClick={() => setDeleteOpen(true)}
          title="Delete"
          disabled={ownPermission !== 'own'}
        />
      );

      const zoomFactor = WB_ZOOM_FACTOR * 1.2;

      // -- Zoom out
      const ZoomOutButton = () => (
        <HeaderButton
          onClick={() => scaleWhiteboardZoom(whiteboardId, 1.0 / zoomFactor)}
          title={<ZoomOut />}
          tooltip='Zoom Out (Alt + Scroll Down)'
        />
      );

      // -- Zoom in
      const ZoomInButton = () => (
        <HeaderButton
          onClick={() => scaleWhiteboardZoom(whiteboardId, zoomFactor)}
          title={<ZoomIn />}
          tooltip='Zoom In (Alt + Scroll Up)'
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
                  <ZoomOutButton />,
                  <ZoomInButton />,
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
            <div>
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
                    rootCanvasId={rootCanvasId}
                    shapeAttributes={shapeAttributesState}
                    onSelectCanvasDimensions={handleCreateCanvasDimensions}
                  />
                </div>
              </div>
            </div>
      
            {/** Modal that opens to share the whiteboard **/}
            <ShareWhiteboardForm
              open={shareOpen}
              onOpenChange={setShareOpen}
            />

            {/** Create Canvas Modal **/}
            <CreateCanvasMenu
              open={createCanvasOpen}
              onOpenChange={setCreateCanvasOpen}
              onCreate={handleNewCanvas}
            />

            {/** Delete Whiteboard Modal **/}
            <DeleteWhiteboardForm
              open={deleteOpen}
              onOpenChange={setDeleteOpen}
              whiteboardId={whiteboardId}
              onSubmit={handleSubmitDeleteWhiteboard}
            />
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

  const stageRef : RefObject<Konva.Stage | null> = useRef(null);
  const canvasObjectRefsByIdRef : RefObject<Record<CanvasObjectIdType, RefObject<Konva.Shape | null>>> = useRef({});
  const selectedObjectRefsByIdRef : RefObject<Record<CanvasObjectIdType, RefObject<Konva.Shape | null>>> = useRef({});

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
      stageRef={stageRef}
      canvasObjectRefsByIdRef={canvasObjectRefsByIdRef}
      selectedObjectRefsByIdRef={selectedObjectRefsByIdRef}
      currentDispatcherRef={currentDispatcherRef}
      canvasGroupRefsByIdRef={canvasGroupRefsByIdRef}
    >
      <Whiteboard />
    </WhiteboardProvider>
  );
};// end WrappedWhiteboard

export default WrappedWhiteboard;
