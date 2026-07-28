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
  type AxiosError,
} from 'axios';

import {
  toast,
} from 'react-toastify';

// -- local imports
import AuthContext from '@/context/AuthContext';

import AuthInput from "./AuthInput";

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

interface LoginPayload { 
  authSource: string; 
  email: string; 
  password: string; 
  transferWhiteboardId: string | null; 
}

export const LoginForm = (): React.JSX.Element => {
  // -- form fields
  const [email, setEmail] = useState<string>("");
  const [password, setPassword] = useState<string>("");
  const [transferringWhiteboardId, setTransferringWhiteboardId] = useState<string | null>(null);

  // -- ui state
  const [uiStatus, setUiStatus] = useState<'ok' | 'err_user' | 'err_system'>('ok');

  const location = useLocation();
  const navigate = useNavigate();

  const authContext = useContext(AuthContext);
  if (! authContext) throw new Error('AuthContext not provided');
  const { handleLogin } = authContext;

  const [changeNameOpen, setChangeNameOpen] = useState(false);

  const [submitButtonStatus, setSubmitButtonStatus] = useState<ButtonStatus>('enabled');

  // TODO: Make this dynamic to handle either email or username
  const authSource = "email";

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();

      // -- derived state
      const searchParams = new URLSearchParams(location.search);
      const tempWhiteboardId = searchParams.get('tempWhiteboardId');
      const redirectUrl = searchParams.has('redirect') ?
        decodeURIComponent(searchParams.get('redirect') || '')
        : '/dashboard';
      const endpoint = "/auth/login";

      setSubmitButtonStatus('pending');

      const payload: LoginPayload = ({
        authSource,
        email,
        password,
        transferWhiteboardId: tempWhiteboardId
      });

      try {
        let isTransferring = false;
        const res : AxiosResponse<AuthLoginSuccessResponse> = await api.post(endpoint, payload);
        
        const {
          user,
          sessionToken,
        } = res.data;

        // -- Attempt to transfer temp whiteboard if applicable
        if (tempWhiteboardId) {
          try {
            await api.post(`/whiteboards/${encodeURIComponent(tempWhiteboardId)}/convert_temp_to_perm`, {
              user: { _id: user.id }
            });

            setTransferringWhiteboardId(tempWhiteboardId);

            // -- Prompt user to change name of whiteboard from default "Trial Whiteboard"
            setChangeNameOpen(true);
            isTransferring = true;

            toast.success("Whiteboard added to your whiteboards!");
          } catch (err: unknown) {
            if (axios.isAxiosError(err)) {
              const message = 
                err.response?.status === 403
                  ? "You must be the owner of the whiteboard to add it to your account."
                  : "Could not transfer whiteboard.";
              
              toast.warn(message);
            } else {
              toast.warn("Could not transfer whiteboard.");
            }

            console.error('Error transferring temp whiteboard');
          }
        }

        setUiStatus('ok'); // -- ensure fields are not highlighted as errors
        handleLogin(user, sessionToken);

        if (!isTransferring) {
          navigate(redirectUrl);
        }
      } catch (err: unknown) {
        const axiosErr = err as AxiosError;

          if ((axiosErr?.response?.status) && (axiosErr.response.status >= 400) && (axiosErr.response.status < 500)) {
            const status = axiosErr.response.status;

            console.error('Authentication request failed with status', status);

            // === Display error to user ===========================================

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
        } finally {
          setSubmitButtonStatus('enabled');
        }
    },
    [
      email,
      navigate,
      password,
      setSubmitButtonStatus,
      setChangeNameOpen,
      location.search,
      handleLogin,
    ]
  );// -- end const handleSubmit

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

  const handleToggle = useCallback(
    () => {
      navigate('/signup');
    },
    [navigate]
  );// -- end handleToggle

  return (
    <div className="flex flex-col w-75 sm:w-95 md:w-120">
      <h1 className="text-2xl text-h1-text font-bold text-center mb-6">
        Welcome Back!
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
          name="Password"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="********"
          variant={uiStatus === 'err_user' ? 'error' : 'default'}
        />
        <Button
          type="submit"
          status={submitButtonStatus}
          className="w-full font-medium text-h2-text py-2 my-2 rounded-lg border-border border-1 bg-button-300 hover:bg-button-hover hover:cursor-pointer shadow-md"
        >
          Log In
        </Button>
      </form>

      {/* Toggle Login/Signup */}
      <div className="flex justify-center mt-4 pt-6 border-t-1 border-border">
        <div className="text-h2-text p-2 text-center">
          New to {APP_NAME}?
        </div>
        <button 
          onClick={handleToggle}
          className="text-h2-text font-medium rounded-lg border-border border-1 px-4 bg-button-600 hover:bg-button-hover hover:cursor-pointer shadow-md"
        >
          Create a New Account!
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
};// -- end LoginForm
