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

const ACTIVE_USERS_LIMIT = 1;

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

  const activeUsersLength =  Object.keys(activeUsers).length;

  return (
    activeUsersLength <= ACTIVE_USERS_LIMIT
      ? 
      // Display all user icons side-by-side on header
      <div className="flex items-center gap-1">
        {activeUsers && Object.values(activeUsers).map((u) => (
          <div
            key={u.clientId}
            className="w-8 h-8 rounded-full flex items-center justify-center text-sm font-semibold text-white select-none"
            style={{ border: `2px solid ${u.color}` }}
            title={u.username}
          >
            {u.username[0].toUpperCase()}
          </div>
        ))}
      </div>
      : 
      // Display first <ACTIVE_USERS_LIMIT> user icons on header with dropdown option to see all
      <DropdownMenu
        key="active-users"
        open={isActiveUsersOpen}
        onOpenChange={setIsActiveUsersOpen}
      >
        <div className='flex justify-center items-center gap-2'>
          {activeUsers && Object.values(activeUsers).slice(0, ACTIVE_USERS_LIMIT).map((u) => (
            <div
              key={u.clientId}
              className="w-8 h-8 rounded-full flex items-center justify-center text-sm font-semibold text-white select-none"
              style={{ border: `2px solid ${u.color}` }}
              title={u.username}
            >
              {u.username[0].toUpperCase()}
            </div>
          ))}
          <DropdownMenuTrigger className="text-header-button-text group flex items-center gap-1 px-0 py-2 rounded-lg hover:cursor-pointer hover:text-header-button-text-hover whitespace-nowrap" title="View all active users">
            {`... +${activeUsersLength - ACTIVE_USERS_LIMIT}`}
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
                    strokeWidth={2}
                  />
                  <span className="pl-2">
                    {u.username}
                  </span>
                </DropdownMenuLabel>
              ))}
            </div>
          </DropdownMenuContent>
        </div>
      </DropdownMenu>
  );
};// -- end ActiveUsersHeaderDropdown
