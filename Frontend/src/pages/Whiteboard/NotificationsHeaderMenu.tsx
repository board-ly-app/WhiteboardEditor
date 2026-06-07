// === Whiteboard/NotificationsHeaderMenu.tsx ==================================
//
// Localized notifications header menu, which subscribes to its own state from
// the global state store. Wrapper around components/NotificationsHeaderMenu.tsx
//
// =============================================================================

// -- std imports
import {
  useState,
  useCallback,
  useContext,
  useEffect,
} from 'react';

// -- third-party imports
import {
  useSelector,
} from 'react-redux';

import lodash from 'lodash';

import {
  LoaderCircle,
} from 'lucide-react';

// -- local imports
import api from '@/api/axios';

import {
  type UserIdType,
} from '@/types/WebSocketProtocol';

import {
  type Notification,
  type NotificationRequestCanvasEditPermission,
} from '@/types/Notification';

import {
  type User,
} from '@/types/User';

import {
  type RootState,
  store,
} from '@/store';

import {
  selectNotifications,
} from '@/store/notifications/notificationsSelectors';

import {
  selectCanvasById,
} from '@/store/canvases/canvasesSelectors';

import {
  selectAllowedUsersByCanvas,
} from '@/store/allowedUsers/allowedUsersByCanvasSlice';

import {
  removeNotifications,
} from '@/controllers';

import UserCacheContext from '@/context/UserCacheContext';

import {
  ClientMessengerContext,
} from '@/context/ClientMessengerContext';

import WhiteboardContext from '@/context/WhiteboardContext';

import {
  NotificationsHeaderMenu as NotificationsHeaderMenuUI,
} from '@/components/NotificationsHeaderMenu';

import {
  Button,
} from '@/components/ui/button';

interface RequestCanvasEditPermDescriptionProps {
  notification: NotificationRequestCanvasEditPermission;
}// -- end interface RequestCanvasEditPermDescriptionProps

const RequestCanvasEditPermDescription = ({
  notification,
}: RequestCanvasEditPermDescriptionProps): React.ReactNode => {
  const {
    id: notificationId,
    whiteboardId,
    canvasId,
    grantee: granteeId,
  } = notification;

  const canvasName : string | null = useSelector(
    (state: RootState) => selectCanvasById(state, canvasId)?.name ?? null,
    lodash.isEqual
  );

  if (! canvasName) {
    throw new Error(`Canvas ${canvasId} not found`);
  }

  const userCacheContext = useContext(UserCacheContext);

  if (! userCacheContext) {
    throw new Error('No UserCacheContext provided');
  }

  const {
    getUserById,
  } = userCacheContext;

  const clientMessengerContext = useContext(ClientMessengerContext);

  if (! clientMessengerContext) {
    throw new Error('No ClientMessengerContext provided');
  }

  const {
    clientMessenger,
  } = clientMessengerContext;

  const whiteboardContext = useContext(WhiteboardContext);

  if (! whiteboardContext) {
    throw new Error('No WhiteboardContext provided');
  }

  const [grantee, setGrantee] = useState<User | null>(null);

  const handleApproveRequest = useCallback(
    () => {
      if (clientMessenger) {
        const state : RootState = store.getState();
        const currAllowedUsers : Record<UserIdType, unknown> | null = selectAllowedUsersByCanvas(state, canvasId);

        // -- if null, user already has accesss by default
        if (currAllowedUsers) {
          clientMessenger.sendUpdateCanvasAllowedUsers({
            type: 'update_canvas_allowed_users',
            canvasId,
            allowedUsers: [...Object.keys(currAllowedUsers), granteeId],
          });

          api.delete('/notifications', {
            data: {
              notificationId,
            },
          });
          removeNotifications([notificationId]);
        }
      }
    },
    [canvasId, granteeId, notificationId, clientMessenger]
  );// -- end handleApproveRequest

  useEffect(
    () => {
      const fetchGrantee = async () => {
        setGrantee(await getUserById(granteeId));
      };// -- end fetchGrantee

      fetchGrantee();
    },
    [granteeId, setGrantee, getUserById]
  );

  if (! grantee) {
    return (<LoaderCircle />);
  } else {
    return (
      <>
        {grantee.username} is requesting permission to edit canvas "{canvasName}"

        {(whiteboardId === whiteboardContext.whiteboardId) && (
          <Button
            size="sm"
            onClick={handleApproveRequest}
          >
            Approve
          </Button>
        )}
      </>
    );
  }
};// -- end RequestCanvasEditPermDescription

export const NotificationsHeaderMenu = (): React.JSX.Element => {
  const notificationsById = useSelector(
    (state: RootState) => selectNotifications(state),
    lodash.isEqual
  );

  const [isExpanded, setIsExpanded] = useState<boolean>(false);
  const getNotificationDescription = useCallback(
    (notif: Notification) => {
      switch (notif.kind) {
        case 'request_canvas_edit_permission':
          return (<RequestCanvasEditPermDescription notification={notif} />);
      }// -- end switch (notif.kind)
    },
    []
  );// -- end getNotificationDescription

  return (
    <div className="flex z-50">
      <NotificationsHeaderMenuUI
        notifications={notificationsById}
        isExpanded={isExpanded}
        setIsExpanded={setIsExpanded}
        getNotificationDescription={getNotificationDescription}
      />
    </div>
  );
};// -- end NotificationsHeaderMenu
