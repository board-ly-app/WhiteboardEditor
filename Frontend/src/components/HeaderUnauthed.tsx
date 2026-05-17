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
import { useCallback, useState } from 'react';

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

  const pathname = location.pathname;
  const [action, setAction] = useState<"login" | "signup">("login");
  
  const handleLogin = useCallback(() => {
    if (pathname.startsWith("/login")) {
      console.log("from login");
      navigate("/login");
    } 
    else if (pathname.startsWith("/whiteboard")) {
      console.log("log in from whiteboard, open modal");
      openConfirmationModal();
    }
  }, [pathname, navigate, openConfirmationModal]);

  const handleSignup = useCallback(() => {
    if (pathname.startsWith("/signup")) {
      console.log("from signup");
      navigate("/signup");
    } 
    else if (pathname.startsWith("/whiteboard")) {
      console.log("action: ", action);
      console.log("create account from whiteboard, open modal");
      setAction("signup");
      console.log("action after setAction: ", action);
      openConfirmationModal();
    }
  }, [pathname, navigate, openConfirmationModal, setAction]);

  const handleCancel = useCallback(() => {
    closeConfirmationModal();
  }, [closeConfirmationModal]);

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
              onClick={handleSignup}
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
            action={action}
          />
      </ConfirmationModal>
    </div>
  );
};

export default HeaderUnauthed;
