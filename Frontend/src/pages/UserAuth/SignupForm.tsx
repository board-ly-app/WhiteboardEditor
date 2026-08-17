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
  Link,
} from 'react-router-dom';

import {
  useSelector,
} from 'react-redux';

// -- third-party imports

import {
  type GetFieldType,
} from 'lodash';

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
  setSignupInactive,
  setSignupError,
  setSignupRequestingWhiteboardTransferAuth,
  setSignupRequesting,
  setSignupPendingConfirmation,
  setSignupRequestingConfirmation,
  setSignupRequestingWhiteboardTransfer,
  setSignupRenamingWhiteboard,
  setSignupRequestingWhiteboardRename,
  setSignupLoggingIn,
} from '@/store/userFlows/signup/signupSlice';

import {
  selectSignupFlowState,
} from '@/store/userFlows/signup/signupSelectors';

import {
  Button,
  type ButtonStatus,
} from '@/components/ui/button';

import {
  APP_NAME,
} from '@/app.config';

import {
  type SignupReqBody,
  type SignupSuccessResponse,
  type SignupConfirmationSuccessResponse,
  type WhiteboardConvertTempToPermReqBody,
  type WhiteboardNewNameReqBody,
} from '@/types/APIProtocol';

import ChangeNameTrialWhiteboard from "./ChangeNameTrialWhiteboard";
import ConfirmAccountCreationModal, {
  type ConfirmAccountCreationModalProps,
} from "./ConfirmAccountCreationModal";

export const SignupForm = (): React.JSX.Element => {
  // -- core component state
  const componentState = useSelector((state: RootState) => selectSignupFlowState(state));

  // -- form fields
  const [email, setEmail] = useState<string>("");
  const [username, setUsername] = useState<string>("");
  const [password, setPassword] = useState<string>("");
  const [confirmPassword, setConfirmPassword] = useState<string>("");

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
        case 'requesting_confirmation':
        case 'pending_confirmation':
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
        {
          if (email.length < 1) return 'disabled';
          if (username.length < 1) return 'disabled';
          if (password.length < 1) return 'disabled';
          if (password !== confirmPassword) return 'disabled';

          return 'enabled';
        }
        case 'renaming_whiteboard':
        case 'pending_confirmation':
        case 'logging_in':
          return 'disabled';
        case 'requesting':
        case 'requesting_confirmation':
        case 'requesting_whiteboard_transfer_auth':
        case 'requesting_whiteboard_transfer':
        case 'requesting_whiteboard_rename':
          return 'pending';
      }// -- end switch (componentState.status)
    },
    [componentState, email, username, password, confirmPassword]
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
  const {
    handleLogin,
    user,
  } = authContext;

  // -- Initialize state to inactive on page load
  useEffect(
    () => {
      // -- Reset inputs
      setEmail('');
      setUsername('');
      setPassword('');

      store.dispatch(setSignupInactive({}));
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
            username,
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

              store.dispatch(setSignupRequesting({
                email, username, password,
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

              store.dispatch(setSignupError({
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
            username,
            password,
            whiteboardToTransfer,
          } = componentState;

          // -- API request triggered on rising edge
          const convertingTempUser : boolean = (!! user)
            && (user.kind === 'temp')
            && (!whiteboardToTransfer);
          const endpoint = convertingTempUser ?
            "/users/convert_temp"
            : "/users";

          const payload: SignupReqBody = ({
            email,
            username,
            password,
          });

          api.post(endpoint, payload)
            .then((res: AxiosResponse<SignupSuccessResponse>) => {
              console.log('Signup successful');

              switch (res.data.kind) {
                case 'email':
                {
                  console.log('Email confirmation requested');

                  store.dispatch(setSignupPendingConfirmation({
                    email, whiteboardToTransfer,
                  }));
                }
                break;
                case 'no_email':
                {
                  console.log('No email confirmation requested');

                  handleLogin(res.data.user, res.data.sessionToken);

                  // -- If there is a whiteboard transfer auth token, start the
                  // whiteboard renaming process. Otherwise, proceed immediately to
                  // login.
                  if (whiteboardToTransfer) {
                    store.dispatch(setSignupRequestingWhiteboardTransfer({
                      whiteboardId: whiteboardToTransfer.whiteboardId,
                      whiteboardTransferAuthToken: whiteboardToTransfer.transferAuthToken,
                    }));
                  } else {
                    store.dispatch(setSignupLoggingIn({}));
                  }
                }
                break;
                default:
                  throw new Error('Unrecognized response type');
              }// -- end switch (res.data.kind)
            })
            .catch((e: AxiosError) => {
              console.error('Request to sign up failed with status', e.status);

              if (e.status && (e.status >= 400 && e.status < 500)) {
                store.dispatch(setSignupError({
                  errorKind: 'user',
                  reason: 'Invalid signup credentials',
                }));
              } else {
                store.dispatch(setSignupError({
                  errorKind: 'system',
                  reason: 'Failed to create account',
                }));
              }
            });
        }
        break;
        case 'pending_confirmation':
        {
          const {
            error,
          } = componentState;

          if (error && error.reason) {
            toast.error(error.reason);
          }
        }
        break;
        case 'requesting_confirmation':
        {
          const {
            accountCreationToken,
            email,
            whiteboardToTransfer,
          } = componentState;

          const endpoint = '/users/confirm_account_creation';
          const payload = ({
            token: accountCreationToken,
          });

          api.post(endpoint, payload)
            .then((res: AxiosResponse<SignupConfirmationSuccessResponse>) => {
              handleLogin(res.data.user, res.data.sessionToken);

              if (whiteboardToTransfer) {
                // -- Proceed to whiteboard transfer
                store.dispatch(setSignupRequestingWhiteboardTransfer({
                  whiteboardId: whiteboardToTransfer.whiteboardId,
                  whiteboardTransferAuthToken: whiteboardToTransfer.transferAuthToken,
                }));
              } else {
                // -- Immediately log in
                store.dispatch(setSignupLoggingIn({}));
              }
            })
            .catch((e: AxiosError) => {
              console.error('Account confirmation failed with status code %s', e.status);

              if (e.status && (e.status >= 400 && e.status < 500)) {
                // -- User error
                store.dispatch(setSignupPendingConfirmation({
                  email,
                  whiteboardToTransfer,
                  error: {
                    kind: 'user',
                    reason: 'Invalid or expired account confirmation token',
                  },
                }));
              } else {
                // -- System error
                store.dispatch(setSignupPendingConfirmation({
                  email,
                  whiteboardToTransfer,
                  error: {
                    kind: 'system',
                    reason: 'Failed to confirm account creation',
                  },
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

              store.dispatch(setSignupRenamingWhiteboard({
                whiteboardId,
              }));
            })
            .catch((e: AxiosError) => {
              console.error('Temp whiteboard conversion failed with status code', e.status);

              store.dispatch(setSignupError({
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

              store.dispatch(setSignupLoggingIn({}));
            })
            .catch((e: AxiosError) => {
              console.error('Whiteboard renaming failed with status', e.status);

              if (e.status && (e.status >= 400 && e.status < 500)) {
                store.dispatch(setSignupError({
                  errorKind: 'user',
                  reason: 'Bad request to rename whiteboard',
                }));
              } else {
                store.dispatch(setSignupError({
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
    [componentState, location, user, handleLogin, navigate]
  );// -- end useEffect

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();

      // -- derived state
      const searchParams = new URLSearchParams(location.search);
      const tempWhiteboardId = searchParams.get('transfer_temp_whiteboard');

      if (tempWhiteboardId) {
        store.dispatch(setSignupRequestingWhiteboardTransferAuth({
          whiteboardId: tempWhiteboardId,
          email,
          username,
          password,
        }));
      } else {
        store.dispatch(setSignupRequesting({
          email,
          username,
          password,
        }));
      }
    },
    [
      email,
      username,
      password,
      location.search,
    ]
  );// -- end const handleSubmit

  const handleConfirmNameChange = useCallback(
    (nameFromModal: string) => {
      const currState : RootState = store.getState();
      const componentState = selectSignupFlowState(currState);

      switch (componentState.status) {
        case 'renaming_whiteboard':
        {
          const {
            whiteboardId,
          } = componentState;

          store.dispatch(setSignupRequestingWhiteboardRename({
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
      const componentState = selectSignupFlowState(currState);

      switch (componentState.status) {
        case 'renaming_whiteboard':
        {
          store.dispatch(setSignupLoggingIn({}));
        }
        break;
        default:
          throw new Error(`Cannot skip name change from state ${componentState.status}`);
      }// -- end switch (componentState.status)
    },
    []
  );// -- end handleSkipNameChange

  const handleSubmitAccountConfirmation = useCallback(
    (token: string) => {
      switch (componentState.status) {
        case 'pending_confirmation':
        {
          const {
            email,
            whiteboardToTransfer,
          } = componentState;

          store.dispatch(setSignupRequestingConfirmation({
            accountCreationToken: token,
            email,
            whiteboardToTransfer,
          }));
        }
        break;
        default:
          throw new Error(`Cannot submit account confirmation in state "${componentState.status}"`);
      }// -- end switch (componentState.status)
    },
    [componentState]
  );// -- end handleSubmitAccountConfirmation

  const handleSkipAccountConfirmation = useCallback(
    () => {
      switch (componentState.status) {
        case 'pending_confirmation':
        {
          // -- Redirect to login page
          navigate('/login');
        }
        break;
        default:
          throw new Error(`Cannot skip account confirmation in state "${componentState.status}"`);
      }// -- end switch (componentState.status)
    },
    [componentState, navigate]
  );// -- end handleSkipAccountConfirmation

  const handleToggle = useCallback(
    () => {
      navigate("/login");
    },
    [navigate]
  );// -- end handleToggle

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

      <div className="flex flex-col mt-4 pt-6 border-t-1 border-border">
        {/* Toggle Login/Signup */}
        <div className="flex justify-center">
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

        {/** Confirm account via token **/}
        <div className="flex justify-center items-center">
          <div className="text-h2-text p-2 text-center">
            Received a confirmation email?
          </div>
          <Link
            to="/confirm_account_creation"
            className="text-blue-600 hover:text-blue-300 underline"
          >
            Confirm Account Creation
          </Link>
        </div>
      </div>

      {/* Modal for confirming account creation via token sent via email */}
      {
        (() => {
          switch (componentState.status) {
            case 'pending_confirmation':
            case 'requesting_confirmation':
            {
              let variant : GetFieldType<ConfirmAccountCreationModalProps, 'variant'>;

              switch (componentState.status) {
                case 'pending_confirmation':
                  if (componentState.error?.kind === 'user') {
                    variant = 'error';
                  } else {
                    variant = 'normal';
                  }
                  break;
                case 'requesting_confirmation':
                  variant = 'pending';
                  break;
              }// -- end switch (componentState.status)

              return (
                <ConfirmAccountCreationModal
                  open={true}
                  email={componentState.email}
                  onSubmitToken={handleSubmitAccountConfirmation}
                  onSkip={handleSkipAccountConfirmation}
                  variant={variant}
                />
              );
            }
            default:
              return null;
          }// -- end switch (componentState.status)
        })()
      }

      {/* Modal for changing the name of converted temp to permanent whiteboard */}
      <ChangeNameTrialWhiteboard
        open={changeNameOpen}
        onConfirm={handleConfirmNameChange}
        onSkip={handleSkipNameChange}
      />
    </div>
  );
};// -- end SignupForm
