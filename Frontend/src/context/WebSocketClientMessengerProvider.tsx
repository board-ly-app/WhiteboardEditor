// === WebSocketClientMessengerProvider ========================================
//
// Implements a web-socket based client messenger, to actually communicate with
// the backend server.
//
// =============================================================================

// -- std imports
import {
  useState,
  useEffect,
  useRef,
  useContext,
  useCallback,
  type ReactNode,
} from 'react';

import {
  useParams,
} from 'react-router-dom';

import {
  Bounce,
  toast,
} from 'react-toastify';

// -- local imports
import {
  CURRENT_EDITOR_NUM_MILLIS,
  WHITEBOARD_DELETED_NOTIFICATION_NUM_MILLIS,
  USER_CLIENT_COLOR,
  DEFAULT_CLIENT_COLORS,
} from '@/app.config';

import {
  ClientMessengerContext,
} from '@/context/ClientMessengerContext';

import AuthContext from '@/context/AuthContext';

import {
  useUser,
} from '@/hooks/useUser';

import {
  setAllowedUsersByCanvas,
} from '@/store/allowedUsers/allowedUsersByCanvasSlice';

import {
  type ClientIdType,
  type ClientMessageLogin,
  type SocketServerMessage,
  type CanvasIdType,
} from '@/types/WebSocketProtocol';

import {
  type ClientSummary,
} from '@/types/ClientSummary';

import {
  type IWhiteboardClientMessenger,
} from '@/types/IWhiteboardClientMessenger';

import {
  WhiteboardSocketMessenger,
} from '@/services/whiteboardSocketMessenger';

import {
  ClientColorStack,
} from '@/services/ClientColorStack';

// -- program state
import {
  store,
} from '@/store';

import {
  setClientId,
  setClientCursorPos,
  addWhiteboard,
  deleteWhiteboard,
  setWhiteboardStatus,
  setCanvasObjects,
  removeCanvasObjects,
  addCanvas,
  deleteCanvas,
  mergeCanvas,
  setCurrentEditorsByCanvas,
  removeCurrentEditorsByCanvas,
  setActiveUsersByWhiteboard,
  addActiveUsersByWhiteboard,
  removeSelectorsByCanvasObject,
  removeActiveUsers,
  setSelectorsByCanvasObject,
} from '@/controllers';

// -- type declarations

export interface WebSocketClientMessengerProviderProps {
  children: ReactNode;
}

const WebSocketClientMessengerProvider = ({
  children,
}: WebSocketClientMessengerProviderProps): React.ReactNode => {
  const {
    whiteboard_id: whiteboardId,
  } = useParams();

  if (! whiteboardId) {
    throw new Error('Could not fetch whiteboardId from url params');
  }

  const authContext = useContext(AuthContext);

  if (! authContext) {
    throw new Error('No AuthContext provided to Whiteboard');
  }

  const {
    user,
  } = useUser();

  const {
    authToken,
  } = authContext;

  const dispatch = store.dispatch;

  const [clientMessenger, setClientMessenger] = useState<IWhiteboardClientMessenger | null>(null);
  const webSocketRef = useRef<WebSocket | null>(null);
  const clientIdRef = useRef<ClientIdType | null>(null);
  const clientColorStackRef = useRef<ClientColorStack>(
    new ClientColorStack(DEFAULT_CLIENT_COLORS, [256, 256, 0])
  );
  const summariesByClientRef = useRef<Record<ClientIdType, ClientSummary>>({});
  const currentCanvasEditorTimeoutsByCanvasRef = useRef<Record<CanvasIdType, number>>({});

  // handles incoming web socket messages
  const handleServerMessage = useCallback(
    (event: MessageEvent): void => {
      try {
        const msg = JSON.parse(event.data) as SocketServerMessage;

        switch (msg.type) {
          case 'init_client':
            {
              const {
                clientId,
                whiteboard,
                activeClients,
                selectorsByCanvasObjects,
              } = msg;

              const clientSummaries : ClientSummary[] = Object.values(activeClients).map(user => {
                const color = user.clientId === clientId ?
                  USER_CLIENT_COLOR
                  : clientColorStackRef.current.popColor();
                const clientSummary = {
                  ...user,
                  color
                };

                summariesByClientRef.current[user.clientId] = clientSummary;

                return clientSummary;
              });

              clientIdRef.current = clientId;

              setClientId(dispatch, clientId);
              addWhiteboard(dispatch, whiteboard);
              setActiveUsersByWhiteboard(dispatch, whiteboardId, clientSummaries);
              setSelectorsByCanvasObject(dispatch, selectorsByCanvasObjects);
            }
            break;
          case 'login_users': 
            {
              const {
                users,
              } = msg;

              const clientSummaries : ClientSummary[] = Object.values(users).map(user => {
                const color = user.clientId === clientIdRef.current ?
                  USER_CLIENT_COLOR
                  : clientColorStackRef.current.popColor();
                const clientSummary = {
                  ...user,
                  color
                };

                summariesByClientRef.current[user.clientId] = clientSummary;

                return clientSummary;
              });

              addActiveUsersByWhiteboard(dispatch, whiteboardId, clientSummaries);
            } 
            break;
          case 'logout_users': 
            {
              const {
                clients,
              } = msg;

              // -- retire client colors
              for (const clientId of clients) {
                if (clientId in summariesByClientRef.current) {
                  const {
                    color,
                  } = summariesByClientRef.current[clientId];

                  clientColorStackRef.current.pushColor(color);
                  delete summariesByClientRef.current[clientId];
                }
              }// -- end for user

              // -- remove logged out users
              removeActiveUsers(dispatch, clients);
            } 
            break;
          case 'editing_canvas':
            {
              const {
                clientId,
                canvasId,
              } = msg;

              setCurrentEditorsByCanvas(dispatch, { [canvasId]: clientId });

              // -- set current editor timeout
              const oldCurrentEditorTimeoutId = currentCanvasEditorTimeoutsByCanvasRef.current[canvasId];

              if (oldCurrentEditorTimeoutId) {
                window.clearTimeout(oldCurrentEditorTimeoutId);
                currentCanvasEditorTimeoutsByCanvasRef.current[canvasId] = 0;
              }

              currentCanvasEditorTimeoutsByCanvasRef.current[canvasId] = window.setTimeout(
                () => {
                  removeCurrentEditorsByCanvas(dispatch, [canvasId]);
                  window.clearTimeout(currentCanvasEditorTimeoutsByCanvasRef.current[canvasId]);
                  currentCanvasEditorTimeoutsByCanvasRef.current[canvasId] = 0;
                },
                CURRENT_EDITOR_NUM_MILLIS
              );
            }
            break;
          case 'selected_canvas_object':
            {
              const {
                clientId,
                canvasObjectId,
              } = msg;

              // -- Set selector
              setSelectorsByCanvasObject(dispatch, { [canvasObjectId]: clientId });
            }
            break;
          case 'unselected_canvas_object':
            {
              const {
                canvasObjectId,
              } = msg;

              // -- Remove client color from canvas object
              removeSelectorsByCanvasObject(dispatch, [canvasObjectId]);
            }
            break;
          case 'create_canvas_objects':
            {
              const {
                clientId,
                canvasId,
                canvasObjects,
              } = msg;

              setCanvasObjects(dispatch, canvasId, canvasObjects);
              setCurrentEditorsByCanvas(dispatch, { [canvasId]: clientId });

              const oldCurrentEditorTimeoutId = currentCanvasEditorTimeoutsByCanvasRef.current[canvasId];

              if (oldCurrentEditorTimeoutId) {
                window.clearTimeout(oldCurrentEditorTimeoutId);
                currentCanvasEditorTimeoutsByCanvasRef.current[canvasId] = 0;
              }

              currentCanvasEditorTimeoutsByCanvasRef.current[canvasId] = window.setTimeout(
                () => {
                  removeCurrentEditorsByCanvas(dispatch, [canvasId]);
                  window.clearTimeout(currentCanvasEditorTimeoutsByCanvasRef.current[canvasId]);
                  currentCanvasEditorTimeoutsByCanvasRef.current[canvasId] = 0;
                },
                CURRENT_EDITOR_NUM_MILLIS
              );
            }
            break;
          case 'update_canvas_objects':
            {
              const {
                clientId,
                canvasId,
                canvasObjects,
              } = msg;

              setCanvasObjects(dispatch, canvasId, canvasObjects);
              setCurrentEditorsByCanvas(dispatch, { [canvasId]: clientId });

              const oldCurrentEditorTimeoutId = currentCanvasEditorTimeoutsByCanvasRef.current[canvasId];

              if (oldCurrentEditorTimeoutId) {
                clearTimeout(oldCurrentEditorTimeoutId);
                currentCanvasEditorTimeoutsByCanvasRef.current[canvasId] = 0;
              }

              currentCanvasEditorTimeoutsByCanvasRef.current[canvasId] = window.setTimeout(
                () => {
                  removeCurrentEditorsByCanvas(dispatch, [canvasId]);
                  clearTimeout(currentCanvasEditorTimeoutsByCanvasRef.current[canvasId]);
                  currentCanvasEditorTimeoutsByCanvasRef.current[canvasId] = 0;
                },
                CURRENT_EDITOR_NUM_MILLIS
              );
            }
            break;
          case 'create_canvas':
            {
              const { canvas } = msg;

              addCanvas(dispatch, whiteboardId, canvas);
            }
            break;
          case 'delete_canvases':
            {
              const {
                canvasIds,
              } = msg;

              for (const canvasId of canvasIds) {
                deleteCanvas(dispatch, canvasId);
              }// end for (const canvasId of canvasIds)
            }
            break;
          case 'update_canvas_allowed_users': 
          {
            const {
              canvasId,
              allowedUsers,
            } = msg;

            dispatch(setAllowedUsersByCanvas({ [canvasId]: allowedUsers }));
          }
          break;
          case 'delete_canvas_objects':
          {
              const {
                canvasObjectIds,
              } = msg;

              removeCanvasObjects(dispatch, canvasObjectIds);
          }
          break;
          case 'merge_canvas':
          {
              const {
                canvasId,
              } = msg;

              mergeCanvas(dispatch, canvasId);
          }
          break;
          case 'delete_whiteboard':
          {
              // -- set whiteboard status to "deleting"
              setWhiteboardStatus(dispatch, whiteboardId, "deleting");

              // -- close connection
              if (webSocketRef.current) {
                webSocketRef.current.close();
              }

              // -- set timeout for changing status from "deleting" to "deleted"
              window.setTimeout(
                () => {
                  deleteWhiteboard(dispatch, whiteboardId);
                },
                WHITEBOARD_DELETED_NOTIFICATION_NUM_MILLIS
              );
          }
          break;
          case 'set_cursor_pos':
          {
            const {
              clientId,
              x,
              y,
            } = msg;

            // -- update cursor in state store
            setClientCursorPos(dispatch, clientId, x, y);
          }
          break;
          case 'confirm':
          {
            // -- notify client of success
            const {
              message,
            } = msg;

            toast.success(message);
          }
          break;
          case 'notify':
          {
            // -- Notify user
            // -- TODO: instead, add to notification queue
            const {
              notification,
            } = msg;

            console.log('!! Notification:', notification);
            toast.success(`Notification:${JSON.stringify(notification)}`);
          }
          break;
          case 'error':
            {
              const {
                error,
              } = msg;

              // -- A user-friendly error message to display in a popup
              // notification
              let popupErrorMsg : string;

              switch (error.type) {
                case 'invalid_message':
                  console.error('Socket error: invalid message:', error.clientMessageRaw);
                  // This is a low-level error, which implies that the client
                  // was programmed incorrectly (i.e. programmer error, not user
                  // error). We should indicate to the user that the app
                  // encountered an error and direct them to the information they
                  // need to submit an error report.
                  popupErrorMsg = 'ERROR: app sent an invalid message to the server. See console logs for details';
                  break;
                case 'unauthorized':
                  console.error('Socket error: not authorized to view this whiteboard');
                  popupErrorMsg = 'You are not authorized to view this whiteboard';
                  break;
                case 'not_authenticated':
                  console.error('Socket error: client not authenticated');
                  popupErrorMsg = 'You are not currently logged in';
                  break;
                case 'already_authorized':
                  console.error('Socket error: client cannot authenticate again');
                  popupErrorMsg = 'You are already logged in';
                  break;
                case 'invalid_auth':
                  console.error('Socket error: auth token invalid');
                  popupErrorMsg = 'Your authentication token is invalid';
                  break;
                case 'auth_token_expired':
                  console.error('Socket error: auth token expired');
                  popupErrorMsg = 'Your login session has expired';
                  break;
                case 'user_not_found':
                  console.error(`Socket error: user ${error.userId} not found`);
                  popupErrorMsg = `User ${error.userId} not found`;
                  break;
                case 'whiteboard_not_found':
                  console.error(`Socket error: whiteboard ${error.whiteboardId} not found`);
                  popupErrorMsg = `Whiteboard ${error.whiteboardId} not found`;
                  break;
                case 'canvas_not_found':
                  console.error(`Socket error: canvas ${error.canvasId} not found`);
                  popupErrorMsg = `Canvas ${error.canvasId} not found`;
                  break;
                case 'canvas_object_not_found':
                  console.error(`Socket error: canvas object ${error.canvasObjectId} not found`);
                  popupErrorMsg = `Canvas ${error.canvasObjectId} not found`;
                  break;
                case 'action_forbidden':
                  console.error(`Socket error: action ${error.action} not permitted`);
                  popupErrorMsg = `You are not authorized to ${error.action}`;
                  break;
                case 'canvas_object_already_selected':
                  console.error('Canvas object already selected by client', error.clientId);
                  popupErrorMsg = "Canvas object already selected by another user";
                  break;
                case 'edit_irreversible':
                  console.error('Last edit cannot be reversed');
                  popupErrorMsg = "Last edit cannot be reversed";
                  break;
                case 'other':
                  console.error('Socket error:', error.message);
                  popupErrorMsg = error.message;
                  break;
                default:
                  throw new Error(`Unrecognized error: ${JSON.stringify(error, null, 2)}`);
              }// -- end switch (error.type)

              toast.error(popupErrorMsg, {
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
            break;
          default:
            console.error('Server Message unrecognized:', msg);
            throw new Error(`Server Message unrecognized: ${JSON.stringify(msg, null, 2)}`);
        }// end switch (msg.type)
      } catch (e) {
        console.error('Failed to parse message:', e);
      }
    },
    [dispatch, whiteboardId]
  );// -- end handleServerMessage

  const makeHandleWebSocketOpen = useCallback(
    (ws: WebSocket, wsUri: string): () => void => () => {
      // Send login/auth message with user ID, if currently logged in
      if (! user) {
        console.error('Cannot log into web socket server without authenticated user');
      } else if (! authToken) {
        console.error('Cannot log into web socket server without authentication token');
      } else {
        const messenger = new WhiteboardSocketMessenger(ws);
        const loginMessage : ClientMessageLogin = {
          type: "login",
          jwt: authToken,
        };

        messenger.sendLogin(loginMessage);
        setClientMessenger(messenger);
      }

      console.log(`Established web socket connection to ${wsUri}`);

      ws.onmessage = handleServerMessage;
    },
    [authToken, handleServerMessage, setClientMessenger, user]
  );

  useEffect(
    () => {
      const wsUriScheme : 'ws' | 'wss' = window.location.protocol === 'https:' ? 'wss' : 'ws';
      const wsUri = `${wsUriScheme}://${window.location.host}/ws/${whiteboardId}`;
      const ws : WebSocket = new WebSocket(wsUri);

      ws.onopen = makeHandleWebSocketOpen(ws, wsUri);
      webSocketRef.current = ws;
    },
    [makeHandleWebSocketOpen, whiteboardId]
  );

  return (
    <ClientMessengerContext.Provider value={{
      clientMessenger,
    }}>
      {children}
    </ClientMessengerContext.Provider>
  );
};// -- end WebSocketClientMessengerProvider

export {
  WebSocketClientMessengerProvider,
};
