import {
  useState,
  useContext,
  useEffect,
  useRef,
  useCallback,
  useMemo,
} from 'react';

import {
  useSelector,
} from 'react-redux';

import lodash from 'lodash';

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
  LS_KEY_COPIED_CANVAS_OBJECTS,
  THUMBNAIL_IMAGE_QUALITY,
  DEFAULT_KEYED_SHIFT_DIST,
  LONG_KEYED_SHIFT_DIST,
  SHORT_KEYED_SHIFT_DIST,
} from '@/app.config';

import Canvas from "@/pages/Whiteboard/Canvas";
import CanvasMenu from "@/pages/Whiteboard/CanvasMenu";

import {
  type ClientIdType,
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
  selectPermissionsByUserByWhiteboard,
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
  selectMaxZIndexByCanvas,
} from '@/store/canvasObjects/canvasObjectsSelectors';

import {
  scaleWhiteboardZoom,
  updateWhiteboard,
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
  rootCanvasId: CanvasIdType,
  shapeAttributes: ShapeAttributesState;
  // -- editor identified by user id
  onSelectCanvasDimensions: (canvasId: CanvasIdType, dimensions: NewCanvasDimensions) => void;
}

const CanvasCard = ({
  rootCanvasId,
  shapeAttributes,
  onSelectCanvasDimensions,
}: CanvasCardProps) => {
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
    whiteboardId,
    stageRef,
  } = whiteboardContext;

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

  if (currentZoom === null) {
    throw new Error('No currentZoom provided');
  }

  const currentFocusX : number | null = useSelector(
    (state: RootState) => selectWhiteboardById(state, whiteboardId)?.currentFocusX ?? null,
    lodash.isEqual
  );

  if (currentFocusX === null) {
    throw new Error('No currentFocusX provided');
  }

  const currentFocusY : number | null = useSelector(
    (state: RootState) => selectWhiteboardById(state, whiteboardId)?.currentFocusY ?? null,
    lodash.isEqual
  );

  if (currentFocusY === null) {
    throw new Error('No currentFocusY provided');
  }

  const selectedCanvasId : CanvasIdType | undefined = useSelector(
    (state: RootState) => selectSelectedCanvasByWhiteboard(state, whiteboardId),
    lodash.isEqual
  );

  const activeUsers : Record<ClientIdType, ClientSummary> = useSelector(
    (state: RootState) => selectActiveUsersByWhiteboard(state, whiteboardId),
    lodash.isEqual
  );

  const cursorPositionsByClient : Record<ClientIdType, CursorPosition> = useSelector(
    (state: RootState) => selectCursorPositionsByClients(state, Object.keys(activeUsers)),
    lodash.isEqual
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

  if (! clientId) {
    throw new Error('No clientId provided');
  }

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

  // -- explicit permission only (no effective 'edit' fallback on public whiteboards); 
  // gates operations restricted to explicit owners/editors, like thumbnail updates
  const explicitPermission = useSelector(
    (state: RootState) => selectPermissionsByUserByWhiteboard(state, whiteboardId)?.[user.id] ?? null,
    lodash.isEqual
  );

  // -- set up interval to broadcast cursor position
  const cursorPosRef = useRef<{ x: number; y: number; } | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // -- Set current zoom level
  const scaledWidth = useMemo(
    () => width * currentZoom,
    [width, currentZoom]
  );// -- end scaledWidth

  const scaledHeight = useMemo(
    () => height * currentZoom,
    [height, currentZoom]
  );// -- end scaledHeight
  
  const scrollLeft : number = useMemo(
    () => {
      const viewport = window.visualViewport;

      if (! viewport) {
        throw new Error('No visualViewport provided');
      }

      return Math.max(
        (currentFocusX * currentZoom) - (viewport.width / 2),
        0
      );
    },
    [currentZoom, currentFocusX]
  );// -- end scrollLeft
  
  const scrollTop : number = useMemo(
    () => {
      const viewport = window.visualViewport;

      if (! viewport) {
        throw new Error('No visualViewport provided');
      }

      return Math.max(
        (currentFocusY * currentZoom) - (viewport.height / 2),
        0
      );
    },
    [currentZoom, currentFocusY]
  );// -- end scrollTop

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
  const waitTime = 1000 * 20; // Capture & set thumbnail image every 20 seconds

  // Set the whiteboard thumbnail
  useEffect(() => {
    const interval = setInterval(async () => {
      // -- only explicit owners/editors may update the thumbnail
      if (explicitPermission !== 'own' && explicitPermission !== 'edit') return;

      if (!canvasGroupRefsByIdRef.current) return;

      const dataUrl = captureImage(
        canvasGroupRefsByIdRef,
        rootCanvas.id,
        thumbnailType,
        THUMBNAIL_IMAGE_QUALITY,
      );

      if (!dataUrl) return;

      try {
        await api.put(`/whiteboards/${whiteboardId}/thumbnail`, {
          thumbnailUrl: dataUrl,
        });
        console.log("Thumbnail captured");
      } catch (err: unknown) {
        // best-effort background update; failure must not interrupt the session
        console.error("Error updating thumbnail:", err);
      }
    }, waitTime);

    return () => clearInterval(interval);
  }, [whiteboardId, canvasGroupRefsByIdRef, explicitPermission, rootCanvas.id, waitTime]);

  // -- Handle resetting container scroll
  useEffect(() => {
    const container = containerRef.current;

    if (container) {
      container.scrollLeft = scrollLeft;
      container.scrollTop = scrollTop;
    }
  }, [scrollLeft, scrollTop])

  const handleUnselect = useCallback(
    () => {
      // -- Indicate that user has unselected object(s)
      clientMessenger?.sendUnselectedCanvasObjects({
        type: 'unselected_canvas_objects',
        canvasObjectIds: selectedCanvasObjects,
      });
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
          const currState = store.getState();
          const selectedCanvasObjectIds = selectSelectedCanvasObjectsByWhiteboard(
            currState, whiteboardId, clientId
          );

          if (selectedCanvasObjectIds.length < 1) return;

          const targetObjects : CanvasObjectModel[] = selectedCanvasObjectIds.map(
            objId => selectCanvasObjectById(currState, objId)
          ).filter((obj : CanvasObjectModel | null) => !! obj);

          if (targetObjects.length < 1) return;

          // -- Re-calculate all coordinates relative to the minimum x and y
          // coordinates
          const [minX, minY, minZ] = targetObjects.reduce(
            ([currMinX, currMinY, currMinZ], currObj) => {
              switch (currObj.type) {
                case 'rect':
                case 'text':
                case 'ellipse':
                case 'image':
                  return [
                    Math.min(currMinX, currObj.x),
                    Math.min(currMinY, currObj.y),
                    Math.min(
                      currMinZ,
                      currObj.zIndex === undefined ? currMinZ : currObj.zIndex
                    ),
                  ];
                case 'vector':
                {
                  const minZ = currObj.zIndex === undefined ? currMinZ : currObj.zIndex;
                  let minX = currMinX;
                  let minY = currMinY;

                  for (let i = 0; i < currObj.points.length; ++i) {
                    if (i % 2 === 0) {
                      minX = Math.min(minX, currObj.points[i]);
                    } else {
                      minY = Math.min(minY, currObj.points[i]);
                    }
                  }// -- end for i

                  return [minX, minY, minZ];
                }
                default:
                  throw new Error('Unhandled object type');
              }// -- end switch (currObj.type)
            },
            [width, height, Number.MAX_VALUE]
          );// -- end const [minX, minY]

          // -- Re-assign x and y values plus z indices
          const createdObjects = targetObjects.map(targetObject => {
            const createdObject = { ...targetObject };

            if (createdObject.zIndex === undefined) {
              createdObject.zIndex = 0;
            } else {
              createdObject.zIndex -= minZ;
            }
            
            // -- Reset x and y values
            switch (createdObject.type) {
              case 'rect':
              case 'ellipse':
              case 'text':
              case 'image':
              {
                createdObject.x -= minX;
                createdObject.y -= minY;
              }
              break;
              case 'vector':
              {
                const points = [...createdObject.points];

                for (let i = 0; i < points.length; ++i) {
                  if (i % 2 === 0) {
                    points[i] -= minX;
                  } else {
                    points[i] -= minY;
                  }
                }// -- end for i

                createdObject.points = points;
              }
              break;
              default:
                throw new Error('Unhandled createdObjectect type');
            }// -- end switch (createdObject.type)

            return createdObject;
          });

          localStorage.setItem(
            LS_KEY_COPIED_CANVAS_OBJECTS,
            JSON.stringify(createdObjects)
          );
        };// -- end handleCopyObject

        // handle keypresses within container
        const handleKeyDown = (ev: KeyboardEvent) => {
          const currState = store.getState();
          const selectedCanvasObjects = selectSelectedCanvasObjectsByWhiteboard(
            currState, whiteboardId, clientId
          );
          const selectedCanvasId = selectSelectedCanvasByWhiteboard(currState, whiteboardId);

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
            {
              currentDispatcherRef.current?.handleCancel();

              // -- Unselect all selected objects
              clientMessenger?.sendUnselectedCanvasObjects({
                type: 'unselected_canvas_objects',
                canvasObjectIds: selectedCanvasObjects,
              });
            }
            break;
            case 'ArrowUp':
            case 'ArrowDown':
            case 'ArrowLeft':
            case 'ArrowRight':
            {
              if (! clientMessenger) return;
              if (! selectedCanvasId) return;
              if ((! selectedCanvasObjects) || (selectedCanvasObjects.length === 0)) return;

              // -- Don't let the viewport shift
              ev.preventDefault();

              const canvas = selectCanvasById(currState, selectedCanvasId);
              if (! canvas) throw new Error(`Canvas ${selectedCanvasId} not found`);

              let incremX : number;
              let incremY : number;

              switch (ev.key) {
                case 'ArrowUp':
                  incremX = 0;
                  incremY = -1.0;
                  break;
                case 'ArrowDown':
                  incremX = 0;
                  incremY = 1.0;
                  break;
                case 'ArrowLeft':
                  incremX = -1.0;
                  incremY = 0.0;
                  break;
                case 'ArrowRight':
                  incremX = 1.0;
                  incremY = 0.0;
                  break;
              }// -- end switch (ev.key)

              if (ev.ctrlKey || ev.metaKey) {
                // -- Make this a short shift
                incremX *= SHORT_KEYED_SHIFT_DIST;
                incremY *= SHORT_KEYED_SHIFT_DIST;
              } else if (ev.shiftKey) {
                incremX *= LONG_KEYED_SHIFT_DIST;
                incremY *= LONG_KEYED_SHIFT_DIST;
              } else {
                incremX *= DEFAULT_KEYED_SHIFT_DIST;
                incremY *= DEFAULT_KEYED_SHIFT_DIST;
              }

              try {
                // -- Cancel the shift if shifting any object would bring it out
                // of bounds
                const updatedCanvasObjects = Object.fromEntries(
                  selectedCanvasObjects.map(objId => {
                    const obj = selectCanvasObjectById(currState, objId);

                    if (! obj) throw new Error(`Canvas object ${objId} not found`);

                    let update;

                    switch (obj.type) {
                      case 'rect':
                      case 'text':
                      case 'image':
                      {
                        const nextX = obj.x + incremX;
                        const nextY = obj.y + incremY;

                        if (nextX < 0) throw 'oob';
                        if (nextY < 0) throw 'oob';
                        if (nextX + obj.width > canvas.width) throw 'oob';
                        if (nextY + obj.height > canvas.height) throw 'oob';

                        update = ({ ...obj, x: nextX, y: nextY, });
                      }
                      break;
                      case 'ellipse':
                      {
                        const nextX = obj.x + incremX;
                        const nextY = obj.y + incremY;

                        if (nextX - obj.radiusX < 0) throw 'oob';
                        if (nextY - obj.radiusY < 0) throw 'oob';
                        if (nextX + obj.radiusX > canvas.width) throw 'oob';
                        if (nextY + obj.radiusY > canvas.height) throw 'oob';

                        update = ({ ...obj, x: nextX, y: nextY, });
                      }
                      break;
                      case 'vector':
                      {
                        const updatedPoints = obj.points.map((val, i) => {
                          if (i % 2 === 0) {
                            const nextX = val + incremX;

                            if (nextX < 0 || nextX > canvas.width) throw 'oob';
                            return nextX;
                          } else {
                            const nextY = val + incremY;

                            if (nextY < 0 || nextY > canvas.height) throw 'oob';
                            return nextY;
                          }
                        });// -- end const updatedPoints

                        update = ({ ...obj, points: updatedPoints, });
                      }
                      break;
                    }// -- end switch (obj.type)

                    return [objId, update];
                  })
                );// -- end const updatedCanvasObjects

                clientMessenger.sendUpdateCanvasObjects({
                  type: 'update_canvas_objects',
                  canvasId: selectedCanvasId,
                  canvasObjects: updatedCanvasObjects,
                });
              } catch (e: unknown) {
                // -- Re-throw error if it isn't our specified out-of-bounds
                // error
                if (e !== 'oob') throw e;
              }
            }
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
          toast.success('Object(s) copied to clipboard');
        };// -- end handleCopy

        container.addEventListener('copy', handleCopy);

        // -- Handle cutting objects
        const handleCut = () => {
          const currState = store.getState();
          const selectedCanvasObjects = selectSelectedCanvasObjectsByWhiteboard(
            currState, whiteboardId, clientId
          );
          const selectedCanvasId = selectSelectedCanvasByWhiteboard(currState, whiteboardId);

          if (clientMessenger && selectedCanvasId && selectedCanvasObjects.length > 0) {
            handleCopyObject();
            clientMessenger.sendDeleteCanvasObjects({
              type: 'delete_canvas_objects',
              canvasId: selectedCanvasId,
              canvasObjectIds: selectedCanvasObjects,
            });
            toast.success('Object cut to clipboard');
          }
        };// -- end handleCut

        container.addEventListener('cut', handleCut);

        // -- Handle pasting objects
        const handlePaste = () => {
          const currState = store.getState();
          const selectedCanvasId = selectSelectedCanvasByWhiteboard(currState, whiteboardId);

          if (! clientMessenger) return;
          if (! selectedCanvasId) return;

          const currentObjectData = localStorage.getItem(LS_KEY_COPIED_CANVAS_OBJECTS);
          if (! currentObjectData) return;

          const selectedCanvasRef = canvasGroupRefsByIdRef.current[selectedCanvasId];
          if (! selectedCanvasRef?.current) return;

          const selectedCanvasPointerPos = selectedCanvasRef.current.getRelativePointerPosition();
          if (! selectedCanvasPointerPos) return;

          const selectedCanvasAttribs = selectCanvasById(currState, selectedCanvasId);
          if (! selectedCanvasAttribs) return;

          const createdObjectAttribs : CanvasObjectModel[] = JSON.parse(currentObjectData);
          if ((! Array.isArray(createdObjectAttribs)) || (createdObjectAttribs.length < 1)) return;

          // -- paste on top of everything already on the canvas, discarding
          // any zIndex copied from the source object
          const zIndexBase = selectMaxZIndexByCanvas(currState, selectedCanvasId) + 1;

          // -- set created object position
          for (const attribs of createdObjectAttribs) {
            if (attribs.zIndex === undefined) {
              attribs.zIndex = zIndexBase;
            } else {
              attribs.zIndex += zIndexBase;
            }

            switch (attribs.type) {
              case 'rect':
              case 'text':
              case 'ellipse':
              case 'image':
                attribs.x += selectedCanvasPointerPos.x;
                attribs.y += selectedCanvasPointerPos.y;
                break;
              case 'vector':
                {
                  for (let i = 0; i < attribs.points.length; ++i) {
                    if (i % 2 === 0) {
                      attribs.points[i] += selectedCanvasPointerPos.x;
                    } else {
                      attribs.points[i] += selectedCanvasPointerPos.y;
                    }
                  }// -- end for i
                }
                break;
              default:
                throw new Error(`Unrecognized canvas object data: ${JSON.stringify(attribs)}`);
            }// -- end switch (attribs.type)
          }// -- end for attribs

          createdObjectAttribs.sort((a, b) => {
            if ((a.zIndex || 0) < (b.zIndex || 0)) {
              return -1;
            } else if ((a.zIndex || 0) > (b.zIndex || 0)) {
              return 1;
            } else {
              return 0;
            }
          });

          clientMessenger.sendCreateCanvasObjects({
            type: 'create_canvas_objects',
            canvasId: selectedCanvasId,
            canvasObjects: createdObjectAttribs,
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

        const handleScrollEnd = (e: Event) => {
          // -- only non-wheel scroll events
          e.preventDefault();

          const container = containerRef.current;

          if (! container) return;

          const viewport = window.visualViewport;

          if (! viewport) return;

          const currState : RootState = store.getState();

          if (! (whiteboardId in currState.whiteboards)) return;

          const currentZoom = currState.whiteboards[whiteboardId].currentZoom;

          updateWhiteboard(store.dispatch, whiteboardId, {
            currentFocusX: (container.scrollLeft + (viewport.width * 0.5)) / currentZoom,
            currentFocusY: (container.scrollTop + (viewport.height * 0.5)) / currentZoom,
          });
        };// -- end handleScrollEnd

        container.addEventListener('scrollend', handleScrollEnd);

        return () => {
          container.removeEventListener('pointerdown', handlePointerEvent);
          container.removeEventListener('pointerup', handlePointerEvent);
          container.removeEventListener('keydown', handleKeyDown);
          container.removeEventListener('copy', handleCopy);
          container.removeEventListener('cut', handleCut);
          container.removeEventListener('paste', handlePaste);
          container.removeEventListener('wheel', handleWheel);
          container.removeEventListener('scrollend', handleScrollEnd);
        };
      }
    },
    [
      clientId,
      whiteboardId,
      clientMessenger,
      currentDispatcherRef,
      canvasGroupRefsByIdRef,
      width,
      height,
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
          onClick={handleUnselect}
          width={scaledWidth}
          height={scaledHeight}
          scaleX={currentZoom}
          scaleY={currentZoom}
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
                key={clientId}
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
