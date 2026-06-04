// === components/NotificationsHeaderMenu.tsx ==================================
//
// Dropdown menu for notifications that is intended to appear in the header.
//
// WHen not expanded, presents a small button that lights up to indicate when
// there are unread notifications and displays how many unread messages there
// are.
//
// When expanded, displays a scrollable list of notifications, sorted descending
// by creation time.
//
// =============================================================================

// -- std imports
import {
  type Dispatch,
  useCallback,
} from 'react';

// -- third-party imports
import {
  CircleAlert,
} from 'lucide-react';

// -- local imports
import {
  type NotificationIdType,
  type Notification,
} from '@/types/Notification';

import HeaderButton from '@/components/HeaderButton';

export interface NotificationsHeaderMenuProps {
  notifications: Record<NotificationIdType, Notification>;
  isExpanded: boolean;
  setIsExpanded: Dispatch<boolean | ((old: boolean) => boolean)>;
}// -- end interface NotificationsHeaderMenuProps

interface NotificationsButtonProps {
  numUnreadNotifications: number;
  setIsExpanded: Dispatch<boolean | ((old: boolean) => boolean)>;
}// -- end interface NotificationsButtonProps

const NotificationsButton = ({
  numUnreadNotifications,
  setIsExpanded,
}: NotificationsButtonProps): React.JSX.Element => {
  const handleClick = useCallback(
    () => {
      setIsExpanded((isExpanded: boolean) => (! isExpanded));
    },
    [setIsExpanded]
  );// -- end handleClick

  // -- derived state
  const hasUnread : boolean = (numUnreadNotifications > 0);
  const iconColor = hasUnread ? 'yellow' : 'gray';
  const tooltipText : string = `You have ${numUnreadNotifications} unread notification(s)`;

  return (
    <HeaderButton
      onClick={handleClick}
      title={
        <div
          title={tooltipText}
        >
          <CircleAlert
            color={iconColor}
          />
        </div>
      }
    />
  );
};// -- end NotificationsButton

export const NotificationsHeaderMenu = ({
  notifications,
  setIsExpanded,
}: NotificationsHeaderMenuProps): React.JSX.Element => {
  const numUnreadNotifications: number = Object.values(notifications).reduce(
    (total, currNotif) => {
      if (! currNotif.isRead) {
        return total + 1;
      } else {
        return total;
      }
    },
    0
  );// -- end numUnreadNotifications

  return (
    <>
      <NotificationsButton
        setIsExpanded={setIsExpanded}
        numUnreadNotifications={numUnreadNotifications}
      />
    </>
  );
};
