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

import {
  type AxiosResponse,
  type AxiosError,
} from 'axios';

import {
  Bounce,
  toast,
} from 'react-toastify';

// -- local imports
import AuthContext from '@/context/AuthContext';
import AuthInput from "@/components/AuthInput";
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

interface AuthFormProps {
  initialAction: "login" | "signup";
}

const AuthForm = ({
  initialAction,
}: AuthFormProps): React.JSX.Element => {
  // -- form fields
  const [email, setEmail] = useState<string>("");
  const [username, setUsername] = useState<string>("");
  const [password, setPassword] = useState<string>("");
  const [confirmPassword, setConfirmPassword] = useState<string>("");

  // -- ui state
  const [uiStatus, setUiStatus] = useState<'ok' | 'err_user' | 'err_system'>('ok');

  const location = useLocation();
  const searchParams = new URLSearchParams(location.search);
  const navigate = useNavigate();
  const { setUser } = useUser();
  const action = initialAction;
  const redirectUrl = searchParams.has('redirect') ?
    decodeURIComponent(searchParams.get('redirect') || '')
    : '/dashboard';
  const authContext = useContext(AuthContext);

  if (! authContext) {
    throw new Error('AuthContext not provided');
  }

  const {
    setAuthToken,
  } = authContext;

  const [submitButtonStatus, setSubmitButtonStatus] = useState<ButtonStatus>('enabled');

  // -- derived state
  const endpoint = (action === "login") ? "/auth/login" : "/users";

  // TODO: Make this dynamic to handle either email or username
  const authSource = "email";

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();

      setSubmitButtonStatus('pending');

      const payload = 
        action === "login"
        ? { authSource, email, password }
        : { email, username, password };

      try {
        const res : AxiosResponse<AuthLoginSuccessResponse> = await api.post(endpoint, payload);

        const {
          user,
          token,
        } = res.data;

        // -- ensure fields are not highlit as errors
        setUiStatus('ok');

        setAuthToken(token);
        setUser(user);
        navigate(redirectUrl);
      } catch (err: unknown) {
        const axiosErr = err as AxiosError;

        if ((axiosErr?.response?.status) && (axiosErr.response.status >= 400) && (axiosErr.response.status < 500)) {
          const status = axiosErr.response.status;

          console.log('Authentication request failed with status', status);

          // === Display error to user ===========================================

          // -- ensure fields are highlit
          setUiStatus('err_user');

          // -- display popup alert
          toast.error('Authentication Failed. Try again.', {
            position: "bottom-center",
            autoClose: 10000,
            hideProgressBar: false,
            closeOnClick: false,
            pauseOnHover: true,
            draggable: true,
            progress: undefined,
            theme: "colored",
            transition: Bounce,
          });
        } else {
          console.error('Error handling authentication:', err);

          // -- notify user of a system error (fields not highlit)
          setUiStatus('err_system');

          // -- display error to user
          toast.error('Error handling authentication.', {
            position: "bottom-center",
            autoClose: 10000,
            hideProgressBar: false,
            closeOnClick: false,
            pauseOnHover: true,
            draggable: true,
            progress: undefined,
            theme: "colored",
            transition: Bounce,
          });
        }
      } finally {
        setSubmitButtonStatus('enabled');
      }
    },
    [
      action,
      endpoint,
      email,
      navigate,
      password,
      redirectUrl,
      setAuthToken,
      setUser,
      username,
      setSubmitButtonStatus,
    ]
  );// -- end const handleSubmit

  const handleToggle = () => {
    // -- remove highlighting
    setUiStatus('ok');

    navigate(action === "login" ? "/signup" : "/login");
  }

  return (
    <div className="flex flex-col w-75 sm:w-95 md:w-120">
      <h1 className="text-2xl text-h1-text font-bold text-center mb-6">
        {action === "login" ? "Welcome Back!" : `Welcome to ${APP_NAME}!`}
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
        {action === "signup" && (
          <AuthInput 
            name="Username"
            type="text"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            placeholder="yourname"
            variant={uiStatus === 'err_user' ? 'error' : 'default'}
          />
        )}
        <AuthInput
          name="Password"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="********"
          variant={uiStatus === 'err_user' ? 'error' : 'default'}
        />
        {action === "signup" && (
          <AuthInput
            name="Confirm Password"
            type="password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            placeholder="********"
            variant={uiStatus === 'err_user' ? 'error' : 'default'}
          />
        )}
        <Button
          type="submit"
          status={submitButtonStatus}
          className="w-full font-medium text-h2-text py-2 my-2 rounded-lg border-border border-1 bg-button-300 hover:bg-button-hover hover:cursor-pointer shadow-md"
        >
          {action === "login" ? "Log In" : "Sign Up"}
        </Button>
      </form>

      {/* Toggle Login/Signup */}
      <div className="flex justify-center mt-4 pt-6 border-t-1 border-border">
        <div className="text-h2-text p-2 text-center">
          {action === "login" ? `New to ${APP_NAME}?` : "Already have an account?"}
        </div>
        <button 
          onClick={handleToggle}
          className="text-h2-text font-medium rounded-lg border-border border-1 px-4 bg-button-600 hover:bg-button-hover hover:cursor-pointer shadow-md"
        >
          {action === "login" ? "Create a New Account!" : "Log In"}
        </button>
      </div>
    </div>
  );
};// -- end AuthForm

export default AuthForm;
