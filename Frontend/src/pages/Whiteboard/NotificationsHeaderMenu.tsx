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
import {
  type Notification,
  type NotificationRequestCanvasEditPermission,
} from '@/types/Notification';

import {
  type User,
} from '@/types/User';

import {
  type RootState,
} from '@/store';

import {
  selectNotifications,
} from '@/store/notifications/notificationsSelectors';

import {
  selectCanvasById,
} from '@/store/canvases/canvasesSelectors';

import UserCacheContext from '@/context/UserCacheContext';

import {
  NotificationsHeaderMenu as NotificationsHeaderMenuUI,
} from '@/components/NotificationsHeaderMenu';

interface RequestCanvasEditPermDescriptionProps {
  notification: NotificationRequestCanvasEditPermission;
}// -- end interface RequestCanvasEditPermDescriptionProps

const RequestCanvasEditPermDescription = ({
  notification,
}: RequestCanvasEditPermDescriptionProps): React.ReactNode => {
  const {
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

  const [grantee, setGrantee] = useState<User | null>(null);

  useEffect(
    () => {
      const fetchGrantee = async () => {
        setGrantee(await getUserById(granteeId));
      };// -- end fetchGrantee

      fetchGrantee();
    },
    [granteeId, setGrantee]
  );

  if (! grantee) {
    return (<LoaderCircle />);
  } else {
    return (
      <>
        {grantee.username} is requesting permission to edit canvas "{canvasName}"
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
    <div className="z-50">
      <NotificationsHeaderMenuUI
        notifications={notificationsById}
        isExpanded={isExpanded}
        setIsExpanded={setIsExpanded}
        getNotificationDescription={getNotificationDescription}
      />
    </div>
  );
};// -- end NotificationsHeaderMenu
