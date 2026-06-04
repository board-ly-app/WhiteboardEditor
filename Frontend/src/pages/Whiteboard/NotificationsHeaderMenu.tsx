// === Whiteboard/NotificationsHeaderMenu.tsx ==================================
//
// Localized notifications header menu, which subscribes to its own state from
// the global state store. Wrapper around components/NotificationsHeaderMenu.tsx
//
// =============================================================================

// -- std imports
import {
  useState,
} from 'react';

// -- third-party imports
import {
  useSelector,
} from 'react-redux';

import lodash from 'lodash';

// -- local imports
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

  return (
    <NotificationsHeaderMenuUI
      notifications={notificationsById}
      isExpanded={isExpanded}
      setIsExpanded={setIsExpanded}
    />
  );
};// -- end NotificationsHeaderMenu
