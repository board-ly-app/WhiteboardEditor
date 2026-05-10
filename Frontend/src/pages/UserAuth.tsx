// -- std imports
import {
  useState,
  useCallback,
} from 'react';

// -- local imports
import {
  APP_NAME,
} from '@/app.config';

import HeaderUnauthed from "@/components/HeaderUnauthed";
import AuthForm from "@/components/AuthForm";
import Page from '@/components/Page';
import Footer from '@/components/Footer';
import api from '@/api/axios';
import type { CreateWhiteboardFormData } from '@/components/CreateWhiteboardModal';
import { useNavigate } from 'react-router';
import { useContext } from 'react';
import AuthContext from '@/context/AuthContext';
import { useUser } from '@/hooks/useUser';
import {
  type ButtonStatus,
  Button,
} from '@/components/ui/button';

interface UserAuthProps {
  action: "login" | "signup";
}

const UserAuth = ({
  action,
}: UserAuthProps): React.JSX.Element => {
  const navigate = useNavigate();

  let authActionLabel : string;

  switch (action) {
    case 'login':
      authActionLabel = 'Log in';
      break;
    case 'signup':
      authActionLabel = 'Create an Account';
      break;
    default:
      throw new Error(`unrecognized auth action: ${action}`);
  }// -- end switch (action)

  const pageTitle = `${authActionLabel} | ${APP_NAME}`;

  const { setUser } = useUser();
  const authContext = useContext(AuthContext);

  if (! authContext) {
    throw new Error('AuthContext not provided');
  }

  const {
    setAuthToken,
  } = authContext;

  const [tempWhiteboardButtonStatus, setTempWhiteboardButtonStatus]
    = useState<ButtonStatus>('enabled');

  const handleCreateTrialWhiteboard = useCallback(
    async () => {
      try {
        // -- set temp whiteboard button status to "pending"
        setTempWhiteboardButtonStatus('pending');

        const userResp = await api.post('/users/temp');
        console.log("userResp: ", userResp);

        const {
          user,
          accessToken
        } = userResp.data;

        setAuthToken(accessToken);
        setUser(user);
        
        const tempWhiteboardData: CreateWhiteboardFormData = {
          name: `${userResp.data.user.username}'s Whiteboard`,
          collaboratorPermissions: [],
          width: 3000,
          height: 3000
        };

        // -- make temp whiteboard request
        const whiteboardResp = await api.post('/whiteboards/temp', tempWhiteboardData);

        const {
          id,
        } = whiteboardResp.data;

        if (! id) {
          throw new Error('Received no Whiteboard ID from API response');
        }

        const redirectUrl = `/whiteboard/${id}`;

        navigate(redirectUrl);
      } catch (err) {
        console.log("Error creating trial whiteboard: ", err);
      } finally {
        setTempWhiteboardButtonStatus('enabled');
      }
    },
    [navigate, setAuthToken, setUser, setTempWhiteboardButtonStatus]
  );// -- end handleCreateTrialWhiteboard

  return (
    <Page
      title={pageTitle}
    >
      <HeaderUnauthed
        title={authActionLabel}
      />

      <div className="flex flex-col justify-center items-center pb-12">
        {/** Main branding section **/}
        <div
          id="branding"
          className="text-center mx-16 md:mx-32 lg:mx-56 mt-4 mb-8 md:mb-12"
        >
          <h1 className="text-4xl md:text-8xl text-h1-text font-light mb-2 md:my-8">
            {APP_NAME}
          </h1>

          <Button 
            onClick={handleCreateTrialWhiteboard}
            status={tempWhiteboardButtonStatus}
            className="text-h2-text font-medium rounded-lg border-border border-1 p-4 bg-button-600 hover:bg-button-hover hover:cursor-pointer shadow-md"
          >
            Try it out!
          </Button>

          <h2 className="text-2xl md:text-4xl text-h2-text font-thin my-4">
            The better web whiteboard
          </h2>

          <p className="text-md md:text-lg text-p-text font-sans">
            Need a place to make quick and easy diagrams to share with your colleagues? Look no further — Boardly is here for you.
            Get started in minutes and share your designs with your peers with a simple email invite.
          </p>
        </div>

        {/** Auth portal **/}
        <div className="rounded-lg border-border border-1 shadow-md bg-card-background py-5 px-2 sm:p-10">
          <AuthForm
            initialAction={action}
          />
        </div>
      </div>

      <Footer />
    </Page>
);
};

export default UserAuth;
