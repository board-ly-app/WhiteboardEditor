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
} from 'react';

// -- third-party imports
import {
  useSelector,
} from 'react-redux';

import lodash from 'lodash';

// -- local imports
import {
  type Notification,
  type NotificationRequestCanvasEditPermission,
} from '@/types/Notification';

import {
  type RootState,
} from '@/store';

import {
  selectNotifications,
} from '@/store/notifications/notificationsSelectors';

import {
  selectCanvasById,
} from '@/store/canvases/canvasesSelectors';

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
    grantee,
  } = notification;

  const canvas = useSelector((state: RootState) => selectCanvasById(state, canvasId));

  if (! canvas) {
    throw new Error(`Canvas ${canvasId} not found`);
  }

  // -- TODO: fetch username
  return (
    <>
      User {grantee} is requesting edit access to canvas "{canvas.name}"
    </>
  );
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
