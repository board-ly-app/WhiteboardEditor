import {
  useState,
  useContext,
  useEffect,
  useRef,
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

import {
  Stage,
  Layer,
} from 'react-konva';

import Canvas from "./Canvas";
import CanvasMenu from "./CanvasMenu";

import type {
  ToolChoice,
} from '@/components/Tool';

import {
  type WhiteboardIdType,
  type CanvasIdType,
  type CanvasData,
} from "@/types/WebSocketProtocol";

import {
  type User,
} from '@/types/APIProtocol';

import UserCacheContext from '@/context/UserCacheContext';

import {
  type ShapeAttributesState,
} from '@/reducers/shapeAttributesReducer';

import {
  type RootState,
} from '@/store';

import {
  selectAllowedUsersByCanvas,
} from '@/store/allowedUsers/allowedUsersByCanvasSlice';

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
  childCanvasesByCanvas: Record<CanvasIdType, CanvasIdType[]>;
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
    selectedCanvasId,
    tooltipText,
    editingText,
    canvasGroupRefsByIdRef,
  } = whiteboardContext;

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

  const allowedUserIds = useSelector(
    // ['', ''] is effectively a null canvas key
    (state: RootState) => selectAllowedUsersByCanvas(state, selectedCanvasId ?? '')
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
  }, [whiteboardId]);

  // Handle initial scroll to the center of the stage
  const containerRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const container = containerRef.current;
    if (container) {
      container.scrollLeft = (width - container.clientWidth) / 2;
      container.scrollTop = (height - container.clientHeight) / 2;
    }
  }, [width, height])

  return (
    <div className="flex flex-col">
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
          width={width}
          height={height}
        >
          <Layer>
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
        </Stage>
      </div>

      {/* Canvas Menu & Tooltip Text */}
      {selectedCanvasId && (
        <div className='fixed bottom-6 left-2 flex justify-between items-end gap-4 w-[95vw] z-50'>
          <CanvasMenu 
            name={selectedCanvas.name}
            canvasId={selectedCanvasId}
            whiteboardId={whiteboardId}
            allowedUsernames={selectedCanvasAllowedUsers
              ?.map(u => u.username)
              ?? []
            }
          />
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
