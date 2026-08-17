// -- std imports
import {
  useState,
  useContext,
  useCallback,
  useEffect,
  useMemo,
} from "react";

import {
  useNavigate,
  useLocation,
} from 'react-router-dom';

import {
  useSelector,
} from 'react-redux';

// -- third-party imports

import {
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
  type RootState,
  store,
} from '@/store';

import {
  setLoginInactive,
  setLoginError,
  setLoginRequestingWhiteboardTransferAuth,
  setLoginRequesting,
  setLoginRequestingWhiteboardTransfer,
  setLoginRenamingWhiteboard,
  setLoginRequestingWhiteboardRename,
  setLoginLoggingIn,
} from '@/store/userFlows/login/loginSlice';

import {
  selectLoginFlowState,
} from '@/store/userFlows/login/loginSelectors';

import {
  Button,
  type ButtonStatus,
} from '@/components/ui/button';

import {
  APP_NAME,
} from '@/app.config';

import {
  type LoginReqBody,
  type LoginSuccessResponse,
  type WhiteboardConvertTempToPermReqBody,
  type WhiteboardNewNameReqBody,
} from '@/types/APIProtocol';

import ChangeNameTrialWhiteboard from "./ChangeNameTrialWhiteboard";

export const LoginForm = (): React.JSX.Element => {
  // -- core component state
  const componentState = useSelector((state: RootState) => selectLoginFlowState(state));

  // -- form fields
  const [email, setEmail] = useState<string>("");
  const [password, setPassword] = useState<string>("");

  // -- ui state
  const uiStatus : 'ok' | 'err_user' | 'err_system' = useMemo(
    () => {
      switch (componentState.status) {
        case 'error':
          switch (componentState.errorKind) {
            case 'user':
              return 'err_user';
            case 'system':
              return 'err_system';
          }// -- end switch (componentState.errorKind)
          break;
        case 'inactive':
        case 'requesting':
        case 'renaming_whiteboard':
        case 'requesting_whiteboard_rename':
        case 'requesting_whiteboard_transfer':
        case 'requesting_whiteboard_transfer_auth':
        case 'logging_in':
          return 'ok';
      }// -- end switch (componentState.status)
    },
    [componentState]
  );// -- end const uiState

  const submitButtonStatus : ButtonStatus = useMemo(
    () => {
      switch (componentState.status) {
        case 'inactive':
        case 'error':
          if ((email.length > 0) && (password.length > 0)) {
            return 'enabled';
          } else {
            return 'disabled';
          }
        case 'renaming_whiteboard':
        case 'logging_in':
          return 'disabled';
        case 'requesting':
        case 'requesting_whiteboard_transfer_auth':
        case 'requesting_whiteboard_transfer':
        case 'requesting_whiteboard_rename':
          return 'pending';
      }// -- end switch (componentState.status)
    },
    [componentState, email, password]
  );// -- end const submitButtonStatus

  const changeNameOpen : boolean = useMemo(
    () => {
      switch (componentState.status) {
        case 'renaming_whiteboard':
          return true;
        default:
          return false;
      }// -- end switch (componentState.status)
    },
    [componentState]
  );// -- end const changeNameOpen

  const location = useLocation();
  const navigate = useNavigate();

  const authContext = useContext(AuthContext);
  if (! authContext) throw new Error('AuthContext not provided');
  const { handleLogin } = authContext;

  // -- Initialize state to inactive on page load
  useEffect(
    () => {
      // -- Reset inputs
      setEmail('');
      setPassword('');

      store.dispatch(setLoginInactive({}));
    },
    [location]
  );// -- end useEffect

  // -- Handle state transitions
  useEffect(
    () => {
      switch (componentState.status) {
        // -- Nothing to do for inactive case
        // case 'inactive':
        // {
        // }
        // break;
        case 'error':
        {
          const {
            reason,
          } = componentState;

          // -- Display a reason, if given
          toast.error(reason);
        }
        break;
        case 'requesting_whiteboard_transfer_auth':
        {
          const {
            whiteboardId,
            email,
            password,
          } = componentState;

          // -- Request transfer auth asynchronously
          const endpoint = `/whiteboards/${encodeURIComponent(whiteboardId)}/auth_convert_temp_to_perm`;
          const payload = ({
            permanentUserEmail: email,
          });

          api.post(endpoint, payload)
            .then((res: AxiosResponse) => {
              if (! ('signedConversionRequest' in res.data)) {
                throw new Error('Response missing field "signedConversionRequest"');
              }

              store.dispatch(setLoginRequesting({
                email, password,
                whiteboardToTransfer: {
                  whiteboardId,
                  transferAuthToken: res.data.signedConversionRequest,
                },
              }));
            })
            .catch((e: AxiosError) => {
              console.error(
                'Failed to request whiteboard transfer authorization; statusCode:',
                e.status
              );

              store.dispatch(setLoginError({
                errorKind: 'system',
                reason: 'Failed to get authorization to transfer temp whiteboard',
              }));
            });
        }
        break;
        case 'requesting':
        {
          const {
            email,
            password,
            whiteboardToTransfer,
          } = componentState;

          // -- API request triggered on rising edge
          const endpoint = "/auth/login";
          const authSource = 'email';

          const payload: LoginReqBody = ({
            authSource,
            email,
            password,
          });

          api.post(endpoint, payload)
            .then((res: AxiosResponse<LoginSuccessResponse>) => {
              console.log('Login successful');
              handleLogin(res.data.user, res.data.sessionToken);

              // -- If there is a whiteboard transfer auth token, start the
              // whiteboard renaming process. Otherwise, proceed immediately to
              // login.
              if (whiteboardToTransfer) {
                store.dispatch(setLoginRequestingWhiteboardTransfer({
                  whiteboardId: whiteboardToTransfer.whiteboardId,
                  whiteboardTransferAuthToken: whiteboardToTransfer.transferAuthToken,
                }));
              } else {
                store.dispatch(setLoginLoggingIn({}));
              }
            })
            .catch((e: AxiosError) => {
              console.error('Request to log in failed with status', e.status);

              if (e.status && (e.status >= 400 && e.status < 500)) {
                store.dispatch(setLoginError({
                  errorKind: 'user',
                  reason: 'Invalid login credentials',
                }));
              } else {
                store.dispatch(setLoginError({
                  errorKind: 'system',
                  reason: 'Failed to log in',
                }));
              }
            });
        }
        break;
        case 'requesting_whiteboard_transfer':
        {
          const {
            whiteboardId,
            whiteboardTransferAuthToken,
          } = componentState;

          const endpoint = `/whiteboards/${encodeURIComponent(whiteboardId)}/convert_temp_to_perm`;
          const payload : WhiteboardConvertTempToPermReqBody = ({
            signedConversionRequest: whiteboardTransferAuthToken,
          });

          api.post(endpoint, payload)
            .then((_res) => {
              console.log(
                'Temp whiteboard %s successfully converted to permanent',
                whiteboardId
              );

              store.dispatch(setLoginRenamingWhiteboard({
                whiteboardId,
              }));
            })
            .catch((e: AxiosError) => {
              console.error('Temp whiteboard conversion failed with status code', e.code);

              store.dispatch(setLoginError({
                errorKind: 'system',
                reason: 'Failed to convert whiteboard to permanent',
              }));
            });
        }
        break;
        // -- Nothing to do for RenamingWhiteboard case
        // case 'renaming_whiteboard':
        // break;
        case 'requesting_whiteboard_rename':
        {
          const {
            whiteboardId,
            name,
          } = componentState;

          // -- Send request
          const endpoint = `/whiteboards/${encodeURIComponent(whiteboardId)}/newName`;
          const payload : WhiteboardNewNameReqBody = ({
            newName: name,
          });

          api.put(endpoint, payload)
            .then((_res) => {
              console.log('Whiteboard renaming successful');

              store.dispatch(setLoginLoggingIn({}));
            })
            .catch((e: AxiosError) => {
              console.error('Whiteboard renaming failed with status', e.code);

              if (e.status && (e.status >= 400 && e.status < 500)) {
                store.dispatch(setLoginError({
                  errorKind: 'user',
                  reason: 'Bad request to rename whiteboard',
                }));
              } else {
                store.dispatch(setLoginError({
                  errorKind: 'system',
                  reason: 'Failed to rename whiteboard',
                }));
              }
            });
        }
        break;
        case 'logging_in':
        {
          // -- Navigate to either specified redirect url or dashboard
          const searchParams = new URLSearchParams(location.search);
          const redirectUrl = searchParams.has('redirect') ?
            decodeURIComponent(searchParams.get('redirect') || '')
            : '/dashboard';

          toast.success('Successfully logged in');
          navigate(redirectUrl);
        }
        break;
      }// -- end switch (componentState.status)
    },
    [componentState, location, handleLogin, navigate]
  );// -- end useEffect

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();

      // -- derived state
      const searchParams = new URLSearchParams(location.search);
      const tempWhiteboardId = searchParams.get('transfer_temp_whiteboard');

      if (tempWhiteboardId) {
        store.dispatch(setLoginRequestingWhiteboardTransferAuth({
          whiteboardId: tempWhiteboardId,
          email,
          password,
        }));
      } else {
        store.dispatch(setLoginRequesting({
          email,
          password,
        }));
      }
    },
    [
      email,
      password,
      location.search,
    ]
  );// -- end const handleSubmit

  const handleConfirmNameChange = useCallback(
    (nameFromModal: string) => {
      const currState : RootState = store.getState();
      const componentState = selectLoginFlowState(currState);

      switch (componentState.status) {
        case 'renaming_whiteboard':
        {
          const {
            whiteboardId,
          } = componentState;

          store.dispatch(setLoginRequestingWhiteboardRename({
            whiteboardId,
            name: nameFromModal,
          }));
        }
        break;
        default:
          throw new Error(`Cannot confirm name change from state ${componentState.status}`);
      }// -- end switch (componentState.status)
    },
    []
  );// -- end handleConfirmNameChange
  
  const handleSkipNameChange = useCallback(
    () => {
      const currState : RootState = store.getState();
      const componentState = selectLoginFlowState(currState);

      switch (componentState.status) {
        case 'renaming_whiteboard':
        {
          store.dispatch(setLoginLoggingIn({}));
        }
        break;
        default:
          throw new Error(`Cannot skip name change from state ${componentState.status}`);
      }// -- end switch (componentState.status)
    },
    []
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
