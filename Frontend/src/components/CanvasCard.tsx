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

import {
  type AxiosError,
} from 'axios';

import Konva from 'konva';

import {
  Stage,
  Layer,
  Circle,
} from 'react-konva';

import Canvas from "./Canvas";
import CanvasMenu from "./CanvasMenu";

import type {
  ToolChoice,
} from '@/components/Tool';

import {
  type ClientIdType,
  type WhiteboardIdType,
  type CanvasIdType,
  type CanvasData,
} from "@/types/WebSocketProtocol";

import {
  type ClientSummary,
} from '@/types/ClientSummary';

import {
  type User,
} from '@/types/APIProtocol';

import UserCacheContext from '@/context/UserCacheContext';

import {
  ClientMessengerContext,
} from '@/context/ClientMessengerContext';

import {
  type ShapeAttributesState,
} from '@/reducers/shapeAttributesReducer';

import {
  type RootState,
} from '@/store';

import {
  selectActiveUsersByWhiteboard,
} from '@/store/activeUsers/activeUsersSelectors';

import {
  selectClientId,
} from '@/store/client/clientSelectors';

import {
  selectAllowedUsersByCanvas,
} from '@/store/allowedUsers/allowedUsersByCanvasSlice';

import {
  selectSelectedCanvasByWhiteboard,
} from '@/store/canvases/canvasesSelectors';

import {
  selectSelectedCanvasObjectsByWhiteboard,
} from '@/store/canvasObjects/canvasObjectsSelectors';

import {
  type NewCanvasDimensions,
} from '@/types/CreateCanvas';
import WhiteboardContext from '@/context/WhiteboardContext';
import { captureImage, type ImageTypeEnum } from '@/lib/captureImage';
import api from '@/api/axios';

export interface CanvasCardProps {
  whiteboardId: WhiteboardIdType;
  rootCanvasId: CanvasIdType,
  shapeAttributes: ShapeAttributesState;
  childCanvasesByCanvas: Record<CanvasIdType, Record<CanvasIdType, CanvasIdType>>;
  canvasesById: Record<CanvasIdType, CanvasData>;
  // -- editor identified by user id
  currentTool: ToolChoice;
  onSelectCanvasDimensions: (canvasId: CanvasIdType, dimensions: NewCanvasDimensions) => void;
}

function CanvasCard({
  whiteboardId,
  rootCanvasId,
  shapeAttributes,
  childCanvasesByCanvas,
  canvasesById,
  currentTool,
  onSelectCanvasDimensions,
}: CanvasCardProps) {
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
    tooltipText,
    editingText,
    canvasGroupRefsByIdRef,
    currentDispatcher,
  } = whiteboardContext;

  const selectedCanvasId : CanvasIdType | undefined = useSelector(
    (state: RootState) => selectSelectedCanvasByWhiteboard(state, whiteboardId)
  );

  const activeUsers : Record<ClientIdType, ClientSummary> = useSelector(
    (state: RootState) => selectActiveUsersByWhiteboard(state, whiteboardId)
  );

  const clientMessengerContext = useContext(ClientMessengerContext);

  if (! clientMessengerContext) {
    throw new Error('No ClientMessengerContext provided to CanvasCard');
  }

  const {
    clientMessenger,
  } = clientMessengerContext;

  const [selectedCanvasAllowedUsers, setSelectedCanvasAllowedUsers] = useState<User[] | null>(null);

  const rootCanvas : CanvasData | undefined = canvasesById[rootCanvasId];

  if (! rootCanvas) {
    throw new Error(`Could not find canvas ${rootCanvasId}`);
  }

  const {
    width,
    height,
  } = rootCanvas;

  const selectedCanvas : CanvasData | null = canvasesById[selectedCanvasId ?? ''] || null;

  const clientId : ClientIdType | null = useSelector(
    (state: RootState) => selectClientId(state)
  );

  const allowedUserIds = useSelector(
    // ['', ''] is effectively a null canvas key
    (state: RootState) => selectAllowedUsersByCanvas(state, selectedCanvasId ?? '')
  );

  const selectedCanvasObjects = useSelector(
    (state: RootState) => selectSelectedCanvasObjectsByWhiteboard(
      state, whiteboardId, clientId
    )
  );

  // -- set up interval to broadcast cursor position
  const stageRef = useRef<Konva.Stage | null>(null);

  useEffect(
    () => {
      const timeoutId = window.setInterval(
        () => {
          if (stageRef.current) {
            const pos = stageRef.current.getPointerPosition();

            if (pos) {
              const { x, y } = pos;

              clientMessenger?.sendSetCursorPos({
                type: 'set_cursor_pos', x, y
              });
            }
          }
        },
        1000
      );

      return () => {
        window.clearTimeout(timeoutId);
      };
    },
    [stageRef, clientMessenger]
  );

  useEffect(
    () => {
      if (! selectedCanvas) {
        setSelectedCanvasAllowedUsers(null);
      } else {
        const mapUsers = async () => {
          const newAllowedUsers = (await Promise.all(allowedUserIds
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
          container.focus({
            preventScroll: true,
          });
        };// -- end handlePointerEvent

        container.addEventListener('pointerdown', handlePointerEvent);
        // We need to ensure focus remains after pointerup
        container.addEventListener('pointermove', handlePointerEvent);
        container.addEventListener('pointerup', handlePointerEvent);

        // handle keypresses within container
        const handleKeyDown = (ev: KeyboardEvent) => {
          switch (ev.key) {
            case 'Delete':
            case 'Backspace':
              clientMessenger?.sendDeleteCanvasObjects({
                type: 'delete_canvas_objects',
                canvasObjectIds: selectedCanvasObjects,
              });
              break;
            case 'Escape':
            case 'Esc':
              currentDispatcher?.handleCancel();
              break;
          }
        };// -- end handleKeyDown

        container.addEventListener('keydown', handleKeyDown);

        return () => {
          container.removeEventListener('pointerdown', handlePointerEvent);
          container.removeEventListener('pointermove', handlePointerEvent);
          container.removeEventListener('pointerup', handlePointerEvent);
          container.removeEventListener('keydown', handleKeyDown);
        };
      }
    },
    [containerRef, clientMessenger, selectedCanvasObjects, currentDispatcher]
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
                ...rootCanvas,
                shapeAttributes,
                currentTool,
                childCanvasesByCanvas,
                canvasesById,
                onSelectCanvasDimensions,
              }}
            />
          </Layer>

          {/** Display other users' cursors **/}
          <Layer>
            {Object.values(activeUsers).map(u => u.cursorPos && (
              <Circle
                x={u.cursorPos.x}
                y={u.cursorPos.x}
                width={10}
                height={10}
                fill={u.color}
              />
            ) || null)}
          </Layer>
        </Stage>
      </div>

      {/* Canvas Menu & Tooltip Text */}
      {selectedCanvasId && (
        <div className='pointer-events-none fixed bottom-6 left-2 flex justify-between items-end gap-4 w-[95vw] z-50'>
          <div className="pointer-events-auto">
            <CanvasMenu 
              name={selectedCanvas.name}
              canvasId={selectedCanvasId}
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
