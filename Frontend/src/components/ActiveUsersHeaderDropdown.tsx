import {
  useState,
  useContext,
} from 'react';

import lodash from 'lodash';

import {
  useSelector,
} from 'react-redux';

import {
  ChevronDown,
  Circle,
} from 'lucide-react';

import {
  type ClientIdType,
} from '@/types/WebSocketProtocol';

import {
  type ClientSummary,
} from '@/types/ClientSummary';

import {
  type RootState,
} from '@/store';

import {
  selectActiveUsersByWhiteboard,
} from '@/store/activeUsers/activeUsersSelectors';

import WhiteboardContext from '@/context/WhiteboardContext';

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

export const ActiveUsersHeaderDropdown = () => {
  // TODO: Abstract out a generic dropdown menu
  // Active Users
  const whiteboardContext = useContext(WhiteboardContext);

  if (! whiteboardContext) {
    throw new Error('No WhiteboardContext provided');
  }

  const {
    whiteboardId,
  } = whiteboardContext;

  const [isActiveUsersOpen, setIsActiveUsersOpen] = useState<boolean>(false);

  const activeUsers : Record<ClientIdType, ClientSummary> = useSelector(
    (state: RootState) => selectActiveUsersByWhiteboard(state, whiteboardId) || null,
    lodash.isEqual
  );

  return (
    <DropdownMenu
      key="active-users"
      open={isActiveUsersOpen}
      onOpenChange={setIsActiveUsersOpen}
    >
      <DropdownMenuTrigger className="text-header-button-text group flex items-center gap-1 px-4 py-2 rounded-lg hover:cursor-pointer hover:text-header-button-text-hover whitespace-nowrap">
        Active Users
        <ChevronDown className="w-4 h-4 transition-transform duration-300 group-data-[state=open]:rotate-180"/>
      </DropdownMenuTrigger>
      <DropdownMenuContent>
        <div className="flex flex-col">
          {activeUsers && Object.values(activeUsers).map((u) => (
            <DropdownMenuLabel
              key={u.clientId}
              className="flex flex-row content-center"
            >
              <Circle
                size={20}
                stroke={u.color}
                strokeWidth={4}
              />
              <span className="pl-2">
                {u.username}
              </span>
            </DropdownMenuLabel>
          ))}
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
};// -- end ActiveUsersHeaderDropdown
