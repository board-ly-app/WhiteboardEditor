// === HeaderUnauthed ==========================================================
//
// Framework for header to display when a user is not logged in. Allows extension to
// set title and add buttons and other elements to the left and right sides of
// the header.
//
// =============================================================================

import { useLocation, useNavigate } from 'react-router';
import { useModal } from './Modal';

import Header, {
  type HeaderProps
} from '@/components/Header';

import HeaderButton from '@/components/HeaderButton';
import ConfirmTempToPerm from './ConfirmTempToPerm';

export type HeaderUnauthedProps = HeaderProps;

const HeaderUnauthed = ({
  toolbarElemsLeft = [],
  toolbarElemsRight = [],
  ...props
}: HeaderUnauthedProps): React.JSX.Element => {
  const location = useLocation();
  const navigate = useNavigate();
  const {
      Modal: ConfirmationModal,
      openModal: openConfirmationModal,
      closeModal: closeConfirmationModal,
    } = useModal();
  
  const handleLogin = () => {
    if (location.pathname.startsWith("/login")) {
      console.log("from login");
      navigate("/login");
    } 
    else if (location.pathname.startsWith("/whiteboard")) {
      console.log("from whiteboard, open modal");

      openConfirmationModal();
    }
  };

  const handleCancel = () => {
    closeConfirmationModal();
  }

  return (
    <div>
      <Header
        {...props}
        toolbarElemsLeft={toolbarElemsLeft}
        toolbarElemsRight={[
          ...toolbarElemsRight,
          (
            <HeaderButton 
              onClick={handleLogin}
              title="Log in"
            />
          ),
          (
            <HeaderButton 
              to="/signup"
              title="Create Account"
            />
          ),
        ]}
      />

      {/* Modal for confirming temp whiteboard ownership transfer to logged in user */}
      <ConfirmationModal
        zIndex={20}
        className='p-8 rounded-sm'>
          <ConfirmTempToPerm
            onCancel={handleCancel}
          />
      </ConfirmationModal>
    </div>
  );
};

export default HeaderUnauthed;
