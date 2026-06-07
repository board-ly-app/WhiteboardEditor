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
  useMemo,
  useCallback,
} from 'react';

// -- third-party imports
import lodash from 'lodash';

import {
  useSelector,
} from 'react-redux';

import {
  CircleAlert,
  Circle,
} from 'lucide-react';

// -- local imports
import {
  type NotificationIdType,
  type Notification,
} from '@/types/Notification';

import {
  type RootState,
  store,
} from '@/store';

import {
  selectNotificationById,
} from '@/store/notifications/notificationsSelectors';

import {
  setNotificationsRead,
} from '@/controllers';

import { 
  DropdownMenu, 
  DropdownMenuTrigger, 
  DropdownMenuContent, 
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";

import HeaderButton from '@/components/HeaderButton';

export interface NotificationsHeaderMenuProps {
  notifications: Record<NotificationIdType, Notification>;
  isExpanded: boolean;
  setIsExpanded: Dispatch<boolean | ((old: boolean) => boolean)>;
  getNotificationDescription: (ntf: Notification) => React.ReactNode | string;
}// -- end interface NotificationsHeaderMenuProps

interface NotificationsButtonProps {
  numUnreadNotifications: number;
  setIsExpanded: Dispatch<boolean | ((old: boolean) => boolean)>;
}// -- end interface NotificationsButtonProps

const NotificationsButton = ({
  numUnreadNotifications,
  setIsExpanded,
}: NotificationsButtonProps): React.JSX.Element => {
  // -- derived state
  const hasUnread : boolean = (numUnreadNotifications > 0);
  const iconColor = hasUnread ? 'yellow' : 'gray';
  const tooltipText : string = `You have ${numUnreadNotifications} unread notification(s)`;

  const handleClick = useCallback(
    () => {
      setIsExpanded((isExpanded: boolean) => ! isExpanded);
    },
    [setIsExpanded]
  );// -- end handleClick

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

interface NotificationListItemProps {
  notificationId: NotificationIdType;
  getNotificationDescription: (ntf: Notification) => React.ReactNode | string;
}// -- end interface NotificationListItemProps

const NotificationListItem = ({
  notificationId,
  getNotificationDescription,
}: NotificationListItemProps): React.JSX.Element => {
  const notification : Notification | undefined = useSelector(
    (state: RootState) => selectNotificationById(state, notificationId),
    lodash.isEqual
  );

  if (! notification) {
    throw new Error(`Notification ${notificationId} not found`);
  }

  const handleSelect = useCallback(
    () => {
      setNotificationsRead(store.dispatch, [notificationId]);
    },
    [notificationId]
  );// -- end handleSelect

  const ReadIndicator = useCallback(
    () => (
      <Circle
        size={4}
        color={notification.isRead ? "gray" : "yellow"}
        className="m-2"
      />
    ),
    [notification.isRead]
  );// -- end ReadIndicator

  return (
    <DropdownMenuItem
      onSelect={handleSelect}
    >
      <span className="flex flex-row">
        <ReadIndicator /> {new Date(notification.createdAt).toLocaleString()} | {getNotificationDescription(notification)}
      </span>
    </DropdownMenuItem>
  );
};// -- end NotificationListItem

export const NotificationsHeaderMenu = ({
  notifications,
  isExpanded,
  setIsExpanded,
  getNotificationDescription,
}: NotificationsHeaderMenuProps): React.JSX.Element => {
  const numUnreadNotifications: number = useMemo(
    () => Object.values(notifications).reduce(
      (total, currNotif) => {
        if (! currNotif.isRead) {
          return total + 1;
        } else {
          return total;
        }
      },
      0
    ),
    [notifications]
  );// -- end numUnreadNotifications
  const notificationsSorted : Notification[] = useMemo(
    () => {
      const notifs = Object.values(notifications);

      notifs.sort((a, b) => {
        if (a.createdAt > b.createdAt) {
          return -1;
        } else if (a.createdAt === b.createdAt) {
          return 0;
        } else {
          return 1;
        }
      });

      return notifs;
    },
    [notifications]
  );

  return (
    <DropdownMenu
      open={isExpanded}
      onOpenChange={setIsExpanded}
    >
      {/** Open/close button **/}
      <DropdownMenuTrigger asChild>
        <NotificationsButton
          numUnreadNotifications={numUnreadNotifications}
          setIsExpanded={setIsExpanded}
        />
      </DropdownMenuTrigger>

      {/** Begin list of notifications **/}
      <DropdownMenuContent className="absolute left-24 top-16 w-128 z-100">
        <DropdownMenuLabel className="text-center">
          Notifications ({notificationsSorted.length})
        </DropdownMenuLabel>

        <DropdownMenuSeparator />

        {notificationsSorted.map(notif => (
          <NotificationListItem
            key={notif.id}
            notificationId={notif.id}
            getNotificationDescription={getNotificationDescription}
          />
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
};// -- end NotificationsHeaderMenu
