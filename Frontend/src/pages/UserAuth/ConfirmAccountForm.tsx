// -- std imports
import {
  useContext,
  useCallback,
  useEffect,
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

import api from '@/api/axios';

import {
  type RootState,
  store,
} from '@/store';

import {
  setConfirmAccountPendingConfirmation,
  setConfirmAccountRequestingConfirmation,
  setConfirmAccountRequestingWhiteboardTransfer,
  setConfirmAccountRenamingWhiteboard,
  setConfirmAccountRequestingWhiteboardRename,
  setConfirmAccountLoggingIn,
} from '@/store/userFlows/confirmAccount/confirmAccountSlice';

import {
  selectConfirmAccountFlowState,
} from '@/store/userFlows/confirmAccount/confirmAccountSelectors';

import {
  type SignupConfirmationSuccessResponse,
  type WhiteboardConvertTempToPermReqBody,
  type WhiteboardNewNameReqBody,
} from '@/types/APIProtocol';

import ChangeNameTrialWhiteboard from "./ChangeNameTrialWhiteboard";
import ConfirmAccountCreationModal, {
  type ConfirmAccountCreationModalProps,
} from "./ConfirmAccountCreationModal";

export const ConfirmAccountForm = (): React.ReactNode => {
  // -- core component state
  const componentState = useSelector((state: RootState) => selectConfirmAccountFlowState(state));
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
      const searchParams = new URLSearchParams(location.search);
      const accountCreationToken = searchParams.get('token');
      const whiteboardId = searchParams.get('wb_conversion_id');
      const whiteboardConversionReq = searchParams.get('wb_conversion_req');
      const whiteboardToTransfer = whiteboardId && whiteboardConversionReq && ({
        whiteboardId,
        transferAuthToken: whiteboardConversionReq,
      }) || undefined;

      if (accountCreationToken) {
        store.dispatch(setConfirmAccountRequestingConfirmation({
          accountCreationToken,
          whiteboardToTransfer,
        }));
      } else {
        store.dispatch(setConfirmAccountPendingConfirmation({
          whiteboardToTransfer,
        }));
      }
    },
    [location]
  );// -- end useEffect

  // -- Handle state transitions
  useEffect(
    () => {
      switch (componentState.status) {
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
                store.dispatch(setConfirmAccountRequestingWhiteboardTransfer({
                  whiteboardId: whiteboardToTransfer.whiteboardId,
                  whiteboardTransferAuthToken: whiteboardToTransfer.transferAuthToken,
                }));
              } else {
                // -- Immediately log in
                store.dispatch(setConfirmAccountLoggingIn({}));
              }
            })
            .catch((e: AxiosError) => {
              console.error('Account confirmation failed with status code %s', e.status);

              if (e.status && (e.status >= 400 && e.status < 500)) {
                // -- User error
                store.dispatch(setConfirmAccountPendingConfirmation({
                  whiteboardToTransfer,
                  error: {
                    kind: 'user',
                    reason: 'Invalid or expired account confirmation token',
                  },
                }));
              } else {
                // -- System error
                store.dispatch(setConfirmAccountPendingConfirmation({
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

              store.dispatch(setConfirmAccountRenamingWhiteboard({
                whiteboardId,
              }));
            })
            .catch((e: AxiosError) => {
              console.error('Temp whiteboard conversion failed with status code', e.status);

              store.dispatch(setConfirmAccountPendingConfirmation({
                error: {
                  kind: 'system',
                  reason: 'Failed to convert whiteboard to permanent',
                },
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

              store.dispatch(setConfirmAccountLoggingIn({}));
            })
            .catch((e: AxiosError) => {
              console.error('Whiteboard renaming failed with status', e.status);

              if (e.status && (e.status >= 400 && e.status < 500)) {
                store.dispatch(setConfirmAccountRenamingWhiteboard({
                  whiteboardId,
                  error: {
                    kind: 'user',
                    reason: 'Bad request to rename whiteboard',
                  },
                }));
              } else {
                store.dispatch(setConfirmAccountRenamingWhiteboard({
                  whiteboardId,
                  error: {
                    kind: 'system',
                    reason: 'Failed to rename whiteboard',
                  },
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

  const handleConfirmNameChange = useCallback(
    (nameFromModal: string) => {
      const currState : RootState = store.getState();
      const componentState = selectConfirmAccountFlowState(currState);

      switch (componentState.status) {
        case 'renaming_whiteboard':
        {
          const {
            whiteboardId,
          } = componentState;

          store.dispatch(setConfirmAccountRequestingWhiteboardRename({
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
      const componentState = selectConfirmAccountFlowState(currState);

      switch (componentState.status) {
        case 'renaming_whiteboard':
        {
          store.dispatch(setConfirmAccountLoggingIn({}));
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
            whiteboardToTransfer,
          } = componentState;

          store.dispatch(setConfirmAccountRequestingConfirmation({
            accountCreationToken: token,
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

  // -- "Form" is just a container for modals
  switch (componentState.status) {
    case 'requesting_whiteboard_transfer':
    case 'logging_in':
      return null;
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
          onSubmitToken={handleSubmitAccountConfirmation}
          onSkip={handleSkipAccountConfirmation}
          variant={variant}
        />
      );
    }
    case 'renaming_whiteboard':
    case 'requesting_whiteboard_rename':
      return (
        <ChangeNameTrialWhiteboard
          open={true}
          onConfirm={handleConfirmNameChange}
          onSkip={handleSkipNameChange}
        />
      );
  }// -- end switch (componentState.status)
};// -- end ConfirmAccountForm
