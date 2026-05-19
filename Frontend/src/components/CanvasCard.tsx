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

import Canvas from "./Canvas";
import CanvasMenu from "./CanvasMenu";

import {
  type ClientIdType,
  type WhiteboardIdType,
  type CanvasIdType,
  type CanvasAttribs,
} from "@/types/WebSocketProtocol";

import {
  type ClientSummary,
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
} from '@/store';

import {
  selectActiveUsersByWhiteboard,
} from '@/store/activeUsers/activeUsersSelectors';

import {
  selectClientId,
} from '@/store/client/clientSelectors';

import {
  selectWhiteboardById,
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

  const selectedCanvasId : CanvasIdType | undefined = useSelector(
    (state: RootState) => selectSelectedCanvasByWhiteboard(state, whiteboardId),
    lodash.isEqual
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
          const active = document.activeElement;
          if (active instanceof HTMLTextAreaElement || active instanceof HTMLInputElement) {
            return;
          }
          container.focus({ preventScroll: true });
        };// -- end handlePointerEvent

        container.addEventListener('pointerdown', handlePointerEvent);
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
              currentDispatcherRef.current?.handleCancel();
              break;
          }
        };// -- end handleKeyDown

        container.addEventListener('keydown', handleKeyDown);

        return () => {
          container.removeEventListener('pointerdown', handlePointerEvent);
          container.removeEventListener('pointerup', handlePointerEvent);
          container.removeEventListener('keydown', handleKeyDown);
        };
      }
    },
    [containerRef, clientMessenger, selectedCanvasObjects, currentDispatcherRef]
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
