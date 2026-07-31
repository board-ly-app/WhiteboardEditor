// -- std imports
import {
  useState,
  useContext,
  useCallback,
} from "react";

import {
  useNavigate,
  useLocation,
} from 'react-router-dom';

// -- third-party imports

import axios, {
  type AxiosResponse,
} from 'axios';

import {
  toast,
} from 'react-toastify';

// -- local imports
import AuthContext from '@/context/AuthContext';

import AuthInput from "./AuthInput";

import { useUser } from "@/hooks/useUser";
import api from '@/api/axios';

import {
  Button,
  type ButtonStatus,
} from '@/components/ui/button';

import {
  APP_NAME,
} from '@/app.config';

import {
  type AuthLoginSuccessResponse,
} from '@/types/APIProtocol';

import ChangeNameTrialWhiteboard from "./ChangeNameTrialWhiteboard";

interface SignupPayload { 
  email: string; 
  username: string; 
  password: string; 
  authUser?: { id: string } | null;
}

export const SignupForm = (): React.JSX.Element => {
  // -- form fields
  const [email, setEmail] = useState<string>("");
  const [username, setUsername] = useState<string>("");
  const [password, setPassword] = useState<string>("");
  const [confirmPassword, setConfirmPassword] = useState<string>("");
  const [transferringWhiteboardId, setTransferringWhiteboardId] = useState<string | null>(null);

  // -- ui state
  const [uiStatus, setUiStatus] = useState<'ok' | 'err_user' | 'err_system'>('ok');

  const location = useLocation();
  const navigate = useNavigate();
  const { user, handleLogin } = useUser();
  const tempUser = user?.kind === 'temp' ? user : null;
  const authContext = useContext(AuthContext);
  const [changeNameOpen, setChangeNameOpen] = useState(false);

  if (! authContext) {
    throw new Error('AuthContext not provided');
  }

  const [submitButtonStatus, setSubmitButtonStatus] = useState<ButtonStatus>('enabled');

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();

      try {
        // -- derived state
        const searchParams = new URLSearchParams(location.search);
        const tempWhiteboardId = searchParams.get('transfer_temp_whiteboard');
        const redirectUrl = searchParams.has('redirect') ?
          decodeURIComponent(searchParams.get('redirect') || '')
          : '/dashboard';

        setSubmitButtonStatus('pending');

        // -- If we are going to convert a temporary whiteboard to permanent, we
        // need to authorize the request as the owning temp user first.
        let signedConversionRequest : string | null = null;

        if (tempWhiteboardId) {
          try {
            const endpoint = `/whiteboards/${encodeURIComponent(tempWhiteboardId)}/auth_convert_temp_to_perm`;
            const res = await api.post(endpoint, {
              permanentUserEmail: email,
            });

            if (! ('signedConversionRequest' in res.data)) {
              throw new Error('Response missing field "signedConversionRequest"');
            }

            signedConversionRequest = res.data.signedConversionRequest;
          } catch (e: unknown) {
            console.error('Authorization of temp whiteboard conversion failed:', e);
            toast.error('Authorization of temp whiteboard conversion failed');

            throw e;
          }
        }

        try {
          const endpoint = (tempWhiteboardId && (tempUser !== null)) ?
            "/users/convert_temp"
            : "/users";
          const payload: SignupPayload = ({
            email,
            username,
            password,
          });
          const res : AxiosResponse<AuthLoginSuccessResponse> = await api.post(endpoint, payload);
          
          const {
            user,
            sessionToken,
          } = res.data;

          handleLogin(user, sessionToken);
        } catch (err: unknown) {
          if (axios.isAxiosError(err)) {
            if ((err?.response?.status) && (err.response.status >= 400) && (err.response.status < 500)) {
              const status = err.response.status;

              console.error('Authentication request failed with status', status);

              // -- ensure fields are highlighted
              setUiStatus('err_user');

              // -- display popup alert
              toast.error('Authentication Failed. Try again.');
            } else {
              console.error('Error handling authentication:', err);

              // -- notify user of a system error (fields not highlit)
              setUiStatus('err_system');

              // -- display error to user
              toast.error('Error handling authentication.');
            }
          }

          throw e;
        }

        // -- If applicable, fulfill conversion of temp whiteboard
        if (tempWhiteboardId && signedConversionRequest) {
          try {
            await api.post(`/whiteboards/${encodeURIComponent(tempWhiteboardId)}/convert_temp_to_perm`, {
              signedConversionRequest,
            });

            setTransferringWhiteboardId(tempWhiteboardId);

            // -- Prompt user to change name of whiteboard from default "Trial Whiteboard"
            setChangeNameOpen(true);

            toast.success("Whiteboard added to your whiteboards!");
          } catch (err: unknown) {
            if (axios.isAxiosError(err)) {
              const message = 
                err.response?.status === 403
                  ? "You must be the owner of the whiteboard to add it to your account."
                  : "Could not transfer whiteboard.";
              
              toast.error(message);
            } else {
              toast.error("Could not transfer whiteboard.");
            }

            console.error('Error transferring temp whiteboard');

            throw e;
          }
        } else {
          // If not converting temp whiteboard, navigate to redirect url
          navigate(redirectUrl);
        }
      } finally {
        setSubmitButtonStatus('enabled');
      }
    },
    [
      email,
      navigate,
      password,
      username,
      setSubmitButtonStatus,
      setChangeNameOpen,
      tempUser,
      location.search,
      handleLogin,
    ]
  );// -- end const handleSubmit

  const handleToggle = useCallback(
    () => {
      navigate("/login");
    },
    [navigate]
  );// -- end handleToggle

  const handleConfirmNameChange = useCallback(
    async (nameFromModal: string) => {
      const searchParams = new URLSearchParams(location.search);
      const redirectUrl = searchParams.has('redirect') ?
        decodeURIComponent(searchParams.get('redirect') || '')
        : '/dashboard';

      if (transferringWhiteboardId) {
        try {
          await api.put(`/whiteboards/${transferringWhiteboardId}/newName`, {
            newName: nameFromModal,
          });

          toast.success("Whiteboard name updated!");
        } catch (err) {
          console.error('Error changing whiteboard name:', err);

          const toastMessage = "Whiteboard added to your account, but there was an error updating its name.";
          toast.warn(toastMessage);
        }
      }

      setChangeNameOpen(false);
      navigate(redirectUrl);
    },
    [location.search, setChangeNameOpen, navigate, transferringWhiteboardId]
  );// -- end handleConfirmNameChange
  
  const handleSkipNameChange = useCallback(
    () => {
      const searchParams = new URLSearchParams(location.search);
      const redirectUrl = searchParams.has('redirect') ?
        decodeURIComponent(searchParams.get('redirect') || '')
        : '/dashboard';

      setChangeNameOpen(false);
      navigate(redirectUrl);
    },
    [location.search, setChangeNameOpen, navigate]
  );// -- end handleSkipNameChange

  return (
    <div className="flex flex-col w-75 sm:w-95 md:w-120">
      <h1 className="text-2xl text-h1-text font-bold text-center mb-6">
        Welcome to {APP_NAME}!
      </h1>

      {/* Entry Form */}
      <form
        onSubmit={handleSubmit}
        className="space-y-4"
      >
        <AuthInput
          name="Email"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="you@example.com"
          variant={uiStatus === 'err_user' ? 'error' : 'default'}
        />
        <AuthInput 
          name="Username"
          type="text"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          placeholder="yourname"
          variant={uiStatus === 'err_user' ? 'error' : 'default'}
        />
        <AuthInput
          name="Password"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="********"
          variant={uiStatus === 'err_user' ? 'error' : 'default'}
        />
        <AuthInput
          name="Confirm Password"
          type="password"
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
          placeholder="********"
          variant={uiStatus === 'err_user' ? 'error' : 'default'}
        />
        <Button
          type="submit"
          status={submitButtonStatus}
          className="w-full font-medium text-h2-text py-2 my-2 rounded-lg border-border border-1 bg-button-300 hover:bg-button-hover hover:cursor-pointer shadow-md"
        >
          Sign Up
        </Button>
      </form>

      {/* Toggle Login/Signup */}
      <div className="flex justify-center mt-4 pt-6 border-t-1 border-border">
        <div className="text-h2-text p-2 text-center">
          Already have an account?
        </div>
        <button 
          onClick={handleToggle}
          className="text-h2-text font-medium rounded-lg border-border border-1 px-4 bg-button-600 hover:bg-button-hover hover:cursor-pointer shadow-md"
        >
          Log In
        </button>
      </div>

      {/* Modal for changing the name of converted temp to permanent whiteboard */}
      <ChangeNameTrialWhiteboard
        open={changeNameOpen}
        onConfirm={handleConfirmNameChange}
        onSkip={handleSkipNameChange}
      />
    </div>
  );
};// -- end SignupForm
