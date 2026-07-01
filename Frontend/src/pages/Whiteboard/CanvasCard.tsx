import {
  useState,
  useContext,
  useEffect,
  useRef,
  useCallback,
} from 'react';

import {
  useLocation,
  useNavigate,
} from 'react-router-dom';

import {
  useSelector,
} from 'react-redux';

import lodash from 'lodash';

import {
  type AxiosError,
} from 'axios';

import Konva from 'konva';

import {
  Stage,
  Layer,
  Circle,
} from 'react-konva';

import {
  toast,
} from 'react-toastify';

// -- local imports
import {
  WB_ZOOM_FACTOR,
  LS_KEY_COPIED_CANVAS_OBJECT,
} from '@/app.config';

import Canvas from "@/pages/Whiteboard/Canvas";
import CanvasMenu from "@/pages/Whiteboard/CanvasMenu";

import {
  type ClientIdType,
  type WhiteboardIdType,
  type CanvasIdType,
  type CanvasAttribs,
} from "@/types/WebSocketProtocol";

import {
  type CanvasObjectModel,
} from '@/types/CanvasObjectModel';

import {
  type ClientSummary,
  type CursorPosition,
} from '@/types/ClientSummary';

import {
  type User,
} from '@/types/User';

import UserCacheContext from '@/context/UserCacheContext';

import {
  ClientMessengerContext,
} from '@/context/ClientMessengerContext';

import {
  type ShapeAttributesState,
} from '@/reducers/shapeAttributesReducer';

import {
  type RootState,
  store,
} from '@/store';

import {
  selectActiveUsersByWhiteboard,
  selectCursorPositionsByClients,
} from '@/store/activeUsers/activeUsersSelectors';

import {
  selectClientId,
} from '@/store/client/clientSelectors';

import {
  selectWhiteboardById,
  selectWhiteboardPermissionByUser,
} from '@/store/whiteboards/whiteboardsSelectors';

import {
  selectAllowedUsersByCanvas,
} from '@/store/allowedUsers/allowedUsersByCanvasSlice';

import {
  selectSelectedCanvasByWhiteboard,
  selectCanvasById,
} from '@/store/canvases/canvasesSelectors';

import {
  selectSelectedCanvasObjectsByWhiteboard,
  selectCanvasObjectById,
} from '@/store/canvasObjects/canvasObjectsSelectors';

import {
  scaleWhiteboardZoom,
} from '@/controllers';

import {
  type NewCanvasDimensions,
} from '@/types/CreateCanvas';
import WhiteboardContext from '@/context/WhiteboardContext';
import {
  useUser,
} from '@/hooks/useUser';
import { captureImage, type ImageTypeEnum } from '@/lib/captureImage';
import api from '@/api/axios';

export interface CanvasCardProps {
  whiteboardId: WhiteboardIdType;
  rootCanvasId: CanvasIdType,
  shapeAttributes: ShapeAttributesState;
  // -- editor identified by user id
  onSelectCanvasDimensions: (canvasId: CanvasIdType, dimensions: NewCanvasDimensions) => void;
}

const CanvasCard = ({
  whiteboardId,
  rootCanvasId,
  shapeAttributes,
  onSelectCanvasDimensions,
}: CanvasCardProps) => {
  const location = useLocation();
  const navigate = useNavigate();

  const userCacheContext = useContext(UserCacheContext);

  if (! userCacheContext) {
    throw new Error('No UserCacheContext provided to CanvasCard');
  }

  const {
    getUserById,
  } = userCacheContext;

  const whiteboardContext = useContext(WhiteboardContext);

  if (! whiteboardContext) {
    throw new Error('No WhiteboardContext provided to CanvasCard');
  }

  const {
    canvasGroupRefsByIdRef,
    currentDispatcherRef,
  } = whiteboardContext;

  const tooltipText : string | null = useSelector(
    (state: RootState) => selectWhiteboardById(state, whiteboardId)?.tooltipText ?? null,
    lodash.isEqual
  );

  const editingText : string | null = useSelector(
    (state: RootState) => selectWhiteboardById(state, whiteboardId)?.editingText ?? null,
    lodash.isEqual
  );

  const currentZoom : number | null = useSelector(
    (state: RootState) => selectWhiteboardById(state, whiteboardId)?.currentZoom ?? null,
    lodash.isEqual
  );

  const selectedCanvasId : CanvasIdType | undefined = useSelector(
    (state: RootState) => selectSelectedCanvasByWhiteboard(state, whiteboardId),
    lodash.isEqual
  );

  const activeUsers : Record<ClientIdType, ClientSummary> = useSelector(
    (state: RootState) => selectActiveUsersByWhiteboard(state, whiteboardId)
  );

  const cursorPositionsByClient : Record<ClientIdType, CursorPosition> = useSelector(
    (state: RootState) => selectCursorPositionsByClients(state, Object.keys(activeUsers))
  );

  const clientMessengerContext = useContext(ClientMessengerContext);

  if (! clientMessengerContext) {
    throw new Error('No ClientMessengerContext provided to CanvasCard');
  }

  const {
    clientMessenger,
  } = clientMessengerContext;

  const {
    user,
  } = useUser();

  if (! user) {
    throw new Error('No authenticated user provided');
  }
  const [selectedCanvasAllowedUsers, setSelectedCanvasAllowedUsers] = useState<User[] | null>(null);

  const rootCanvas : CanvasAttribs | null = useSelector(
    (state: RootState) => selectCanvasById(state, rootCanvasId),
    lodash.isEqual
  );

  if (! rootCanvas) {
    throw new Error(`Could not find canvas ${rootCanvasId}`);
  }

  const {
    width,
    height,
  } = rootCanvas;

  const selectedCanvas : CanvasAttribs | null = useSelector(
    (state: RootState) => selectCanvasById(state, selectedCanvasId || null),
    lodash.isEqual
  );

  const clientId : ClientIdType | null = useSelector(
    (state: RootState) => selectClientId(state),
    lodash.isEqual
  );

  const allowedUserIds = useSelector(
    (state: RootState) => selectAllowedUsersByCanvas(state, selectedCanvasId ?? ''),
    lodash.isEqual
  );

  const selectedCanvasObjects = useSelector(
    (state: RootState) => selectSelectedCanvasObjectsByWhiteboard(
      state, whiteboardId, clientId
    ),
    lodash.isEqual
  );

  const ownPermission = useSelector(
    (state: RootState) => selectWhiteboardPermissionByUser(state, whiteboardId, user.id),
    lodash.isEqual
  );

  const stageRef = useRef<Konva.Stage | null>(null);
  const cursorPosRef = useRef<{ x: number; y: number; } | null>(null);

  // -- Set current zoom level
  useEffect(
    () => {
      if (currentZoom === null) return;

      const stage = stageRef.current;

      if (! stage) return;

      const pointer = stage.getPointerPosition();

      if (! pointer) return;

      const oldScale = stage.scaleX();

      const mousePointTo = {
        x: (pointer.x - stage.x()) / oldScale,
        y: (pointer.y - stage.y()) / oldScale,
      };

      stage.scale({
        x: currentZoom,
        y: currentZoom,
      });

      const newPos = {
        x: pointer.x - mousePointTo.x * currentZoom,
        y: pointer.y - mousePointTo.y * currentZoom,
      };

      stage.position(newPos);
    },
    [currentZoom]
  );

  // -- set up interval to broadcast cursor position
  useEffect(
    () => {
      const timeoutId = window.setInterval(
        () => {
          if (stageRef.current && ownPermission !== 'view') {
            const pos = stageRef.current.getRelativePointerPosition();

            if (pos) {
              const { x, y } = pos;
              const coords = { x, y };

              if (! lodash.isEqual(coords, cursorPosRef.current)) {
                cursorPosRef.current = coords;
                clientMessenger?.sendSetCursorPos({
                  type: 'set_cursor_pos', x, y
                });
              }
            }
          }
        },
        50
      );

      return () => {
        window.clearTimeout(timeoutId);
      };
    },
    [stageRef, cursorPosRef, clientMessenger, ownPermission]
  );

  useEffect(
    () => {
      if (! selectedCanvas) {
        setSelectedCanvasAllowedUsers(null);
      } else {
        const mapUsers = async () => {
          const newAllowedUsers = (await Promise.all(Object.keys(allowedUserIds)
            .map(uid => getUserById(uid))))
            .filter(user => !!user);

          setSelectedCanvasAllowedUsers(newAllowedUsers);
        };// -- end mapUsers

        mapUsers();
      }
    },
    [selectedCanvas, allowedUserIds, getUserById]
  );

  const thumbnailType: ImageTypeEnum = "jpeg";
  const thumbnailQuality: number = 0.2;
  const waitTime = 1000 * 20; // Capture & set thumbnail image every 20 seconds

  // Set the whiteboard thumbnail
  useEffect(() => {
    const interval = setInterval(async () => {
      if (!canvasGroupRefsByIdRef.current) return;

      const dataUrl = captureImage(
        canvasGroupRefsByIdRef,
        rootCanvas.id,
        thumbnailType,
        thumbnailQuality,
      );
      
      if (!dataUrl) return;

      try {
        await api.put(`/whiteboards/${whiteboardId}/thumbnail`, {
          thumbnailUrl: dataUrl,
        });
        console.log("Thumbnail captured");
      } catch (err: unknown) {
        console.error("Error updating thumbnail:", err);

        const apiErr = err as AxiosError;

        if (apiErr.status === 403) {
          const locationEncoded : string = encodeURIComponent(`${location.pathname}${location.search}`);

          navigate(`/login?redirect=${locationEncoded}`);
        }
      }
    }, waitTime);

    return () => clearInterval(interval);
  }, [whiteboardId, canvasGroupRefsByIdRef, location.pathname, location.search, navigate, rootCanvas.id, waitTime]);

  // Handle initial scroll to the center of the stage
  const containerRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const container = containerRef.current;

    if (container) {
      container.scrollLeft = (width - container.clientWidth) / 2;
      container.scrollTop = (height - container.clientHeight) / 2;
    }
  }, [width, height])

  const handleUnselect = useCallback(
    () => {
      // -- Indicate that user has unselected object(s)
      for (const objId of selectedCanvasObjects) {
        clientMessenger?.sendUnselectedCanvasObject({
          type: 'unselected_canvas_object',
          canvasObjectId: objId,
        });
      }// -- end for objId
    },
    [clientMessenger, selectedCanvasObjects]
  );// -- end handleUnselect

  useEffect(
    () => {
      if (containerRef.current) {
        const container = containerRef.current;

        // ensure container receives focus while objects within are being
        // manipulated
        const handlePointerEvent = () => {
          const active = document.activeElement;
          if (active instanceof HTMLTextAreaElement || active instanceof HTMLInputElement) {
            return;
          }
          container.focus({ preventScroll: true });
        };// -- end handlePointerEvent

        container.addEventListener('pointerdown', handlePointerEvent);
        container.addEventListener('pointerup', handlePointerEvent);

        const handleCopyObject = () => {
          if (selectedCanvasObjects.length > 0) {
            // -- copy only first shape to localStorage
            const currState = store.getState();
            const targetObjectId = selectedCanvasObjects[0];
            const targetObject = selectCanvasObjectById(currState, targetObjectId);

            if (targetObject) {
              const targetObjectData = JSON.stringify(targetObject);

              localStorage.setItem(LS_KEY_COPIED_CANVAS_OBJECT, targetObjectData);
            }
          }
        };// -- end handleCopyObject

        // handle keypresses within container
        const handleKeyDown = (ev: KeyboardEvent) => {
          switch (ev.key) {
            case 'Delete':
            case 'Backspace':
              if (selectedCanvasId) {
                clientMessenger?.sendDeleteCanvasObjects({
                  type: 'delete_canvas_objects',
                  canvasId: selectedCanvasId,
                  canvasObjectIds: selectedCanvasObjects,
                });
              }
              break;
            case 'Escape':
            case 'Esc':
              currentDispatcherRef.current?.handleCancel();
              break;
            case 'z':
              // -- undo edit
              if (ev.ctrlKey || ev.metaKey) {
                clientMessenger?.sendUndoHistory({
                  type: 'undo_history',
                });
              }
              break;
          }
        };// -- end handleKeyDown

        container.addEventListener('keydown', handleKeyDown);

        // -- Handle copying objects
        const handleCopy = () => {
          handleCopyObject();
          toast.success('Object copied to clipboard');
        };// -- end handleCopy

        container.addEventListener('copy', handleCopy);

        // -- Handle cutting objects
        const handleCut = () => {
          if (clientMessenger && selectedCanvasId && selectedCanvasObjects.length > 0) {
            handleCopyObject();
            clientMessenger.sendDeleteCanvasObjects({
              type: 'delete_canvas_objects',
              canvasId: selectedCanvasId,
              canvasObjectIds: [selectedCanvasObjects[0]],
            });
            toast.success('Object cut to clipboard');
          }
        };// -- end handleCut

        container.addEventListener('cut', handleCut);

        // -- Handle pasting objects
        const handlePaste = () => {
          if (! clientMessenger) return;
          if (! selectedCanvasId) return;

          const currentObjectData = localStorage.getItem(LS_KEY_COPIED_CANVAS_OBJECT);
          if (! currentObjectData) return;

          const selectedCanvasRef = canvasGroupRefsByIdRef.current[selectedCanvasId];
          if (! selectedCanvasRef?.current) return;

          const selectedCanvasPointerPos = selectedCanvasRef.current.getRelativePointerPosition();
          if (! selectedCanvasPointerPos) return;

          const currState = store.getState();

          const selectedCanvasAttribs = selectCanvasById(currState, selectedCanvasId);
          if (! selectedCanvasAttribs) return;

          const createdObjectAttribs : CanvasObjectModel = JSON.parse(currentObjectData);

          // -- set created object position
          switch (createdObjectAttribs.type) {
            case 'rect':
            case 'text':
            case 'ellipse':
              createdObjectAttribs.x = selectedCanvasPointerPos.x;
              createdObjectAttribs.y = selectedCanvasPointerPos.y;
              break;
            case 'vector':
              {
                if (createdObjectAttribs.points.length !== 4) return;
                const [xA, yA, xB, yB] = createdObjectAttribs.points;
                // -- C = leftmost point
                const xC : number = selectedCanvasPointerPos.x;
                const yC : number = selectedCanvasPointerPos.y;
                let xD : number;
                let yD : number;

                if (xA < xB) {
                  xD = xC + (xB - xA);
                  yD = yC + (yB - yA);
                } else {
                  xD = xC + (xA - xB);
                  yD = yC + (yA - yB);
                }

                createdObjectAttribs.points = [xC, yC, xD, yD];
              }
              break;
            default:
              throw new Error(`Unrecognized canvas object data: ${JSON.stringify(createdObjectAttribs)}`);
          }// -- end switch (createdObjectAttribs.type)

          clientMessenger.sendCreateCanvasObjects({
            type: 'create_canvas_objects',
            canvasId: selectedCanvasId,
            canvasObjects: [createdObjectAttribs],
          });
        };// -- end handlePaste

        container.addEventListener('paste', handlePaste);

        // -- Handle scrolling in and out
        const handleWheel = (e: WheelEvent) => {
          // -- only zoom if meta key down
          if ((! e.altKey) && (! e.metaKey)) return;

          e.preventDefault();

          // how to scale? Zoom in? Or zoom out?
          const scaleBy = (e.deltaY > 0) ? WB_ZOOM_FACTOR : (1 / WB_ZOOM_FACTOR);

          scaleWhiteboardZoom(whiteboardId, scaleBy);
        };// -- end handleWheel

        container.addEventListener('wheel', handleWheel);

        return () => {
          container.removeEventListener('pointerdown', handlePointerEvent);
          container.removeEventListener('pointerup', handlePointerEvent);
          container.removeEventListener('keydown', handleKeyDown);
          container.removeEventListener('copy', handleCopy);
          container.removeEventListener('cut', handleCut);
          container.removeEventListener('paste', handlePaste);
          container.removeEventListener('wheel', handleWheel);
        };
      }
    },
    [
      whiteboardId,
      containerRef,
      clientMessenger,
      selectedCanvasId,
      selectedCanvasObjects,
      currentDispatcherRef,
      canvasGroupRefsByIdRef,
    ]
  );

  return (
    <div
      className="flex flex-col"
    >
      {/* Konva Canvas */}
      <div 
        className="border border-black"
        ref={containerRef}
        style={{
          width: "100vw",
          height: "100vh",
          overflow: "scroll",
          background: "#f0f0f0",
        }}
      >
        <Stage
          ref={stageRef}
          width={width}
          height={height}
          onClick={handleUnselect}
        >
          <Layer
          >
            {/** Sub-canvases will be rendered recursively by Canvas component **/}
            <Canvas
              {...{
                id: rootCanvasId,
                shapeAttributes,
                onSelectCanvasDimensions,
              }}
            />
          </Layer>

          {/** Display other users' cursors **/}
          <Layer>
            {Object.entries(cursorPositionsByClient).map(([clientId, cursorPos]) => (
              <Circle
                x={cursorPos.x}
                y={cursorPos.y}
                width={10}
                height={10}
                fill={activeUsers[clientId].color}
              />
            ))}
          </Layer>
        </Stage>
      </div>

      {/* Canvas Menu & Tooltip Text */}
      {selectedCanvas && (
        <div className='pointer-events-none fixed bottom-6 left-2 flex justify-between items-end gap-4 w-[95vw] z-50'>
          <div className="pointer-events-auto">
            <CanvasMenu 
              name={selectedCanvas.name}
              canvasId={selectedCanvas.id}
              whiteboardId={whiteboardId}
              allowedUsernames={selectedCanvasAllowedUsers
                ?.map(u => u.username)
                ?? []
              }
            />
          </div>
          <h2 className='text-dark-text'>
            {editingText}
          </h2>
          <h2 className='text-dark-text'>
            {tooltipText}
          </h2>
        </div>
      )}
    </div>
  );
}

export default CanvasCard;
