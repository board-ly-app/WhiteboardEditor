// === HeaderAuthed ============================================================
//
// Framework for header to display when a user is logged in. Allows extension to
// set title and add buttons and other elements to the left and right sides of
// the header.
//
// =============================================================================

import { useNavigate } from 'react-router-dom';

import { useUser } from '@/hooks/useUser';

import Header, {
  type HeaderProps
} from '@/components/Header';

import HeaderButton from '@/components/HeaderButton';

import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuTrigger, 
} from './ui/dropdown-menu';
import { ChevronDown } from 'lucide-react';

export type HeaderAuthedProps = HeaderProps;

const HeaderAuthed = ({
  toolbarElemsLeft = [],
  toolbarElemsRight = [],
  ...props
}: HeaderAuthedProps): React.JSX.Element => {
  const navigate = useNavigate();
  const { user, setUser } = useUser();

  const handleLogOut = () => {
    setUser(null);
    navigate("/login");
  };

  return (
    <Header
      {...props}
      toolbarElemsLeft={[
        (
          <HeaderButton 
            to={"/dashboard"}
            title="Home"
          />
        ),
        ...toolbarElemsLeft
      ]}
      toolbarElemsRight={[
        ...toolbarElemsRight,
        (
          // Profile Dropdown
          <DropdownMenu key="profile">
            <DropdownMenuTrigger className="text-header-button-text group flex items-center gap-1 text-xl font-bold rounded-md hover:cursor-pointer hover:text-header-button-text-hover">
              {user?.username}
              <ChevronDown className="w-4 h-4 transition-transform duration-300 group-data-[state=open]:rotate-180"/>
            </DropdownMenuTrigger>
            <DropdownMenuContent className='flex flex-col items-center bg-dropdown-background'>
              <DropdownMenuItem asChild>
                <HeaderButton 
                  to="/account" 
                  title="Settings" 
                /> 
              </DropdownMenuItem>
              <DropdownMenuItem asChild>
                <HeaderButton 
                  onClick={handleLogOut}
                  title="Log Out" 
                />
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        ),
      ]}
    />
  );
};

export default HeaderAuthed;
