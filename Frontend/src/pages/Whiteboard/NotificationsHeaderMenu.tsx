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
} from '@/types/Notification';

import {
  type RootState,
} from '@/store';

import {
  selectNotifications,
} from '@/store/notifications/notificationsSelectors';

import {
  NotificationsHeaderMenu as NotificationsHeaderMenuUI,
} from '@/components/NotificationsHeaderMenu';

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
          // -- TODO: fill with username, canvas name
          return `User ${notif.grantee} is requesting edit access to canvas ${notif.canvasId}`;
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
