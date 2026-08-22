import {
  useState,
  useContext,
  useCallback,
  useEffect,
} from "react";

import {
  useLocation,
  useNavigate,
} from 'react-router-dom';

import {
  useSelector,
} from 'react-redux';

import {
  type GetFieldType,
} from 'lodash';

import {
  useForm,
} from "@tanstack/react-form";

import {
  toast,
  Bounce,
} from 'react-toastify';

import {
  type PatchPermanentUserInitialReqBody,
  type PatchPermanentUserConfirmReqBody,
  type PatchPermanentUserResBody,
  type PatchPermanentUserReqPayloadInitial,
} from '@/types/APIProtocol';

import {
  type RootState,
  store,
} from '@/store';

import {
  setUpdateAccountPendingSubmission,
  setUpdateAccountSubmitting,
  setUpdateAccountPendingConfirmation,
  setUpdateAccountRequestingConfirmation,
  setUpdateAccountConfirmed,
} from '@/store/userFlows/updateAccount/updateAccountSlice';

import {
  selectUpdateAccountState,
} from '@/store/userFlows/updateAccount/updateAccountSelectors';

import {
  type ButtonStatus,
  Button,
} from '@/components/ui/button';

import { AppModal } from "@/components/ui/app-modal";

import AuthContext from "@/context/AuthContext";
import HeaderAuthed from "@/components/HeaderAuthed";
import Page from '@/components/Page';
import api from '@/api/axios';

import {
  type AxiosError,
} from 'axios';

import {
  APP_NAME,
} from '@/app.config';

import {
  type User,
} from '@/types/User';

import Footer from "@/components/Footer";

import ConfirmUpdateModal, {
  type ConfirmUpdateModalProps,
  type ConfirmUpdateModalPayload,
} from './ConfirmUpdateModal';

// -- type definitions
type ProfileType = Pick<User, 'username'>;
interface SecureFieldsType {
  newEmail: string;
  confirmNewEmail: string;
  newPassword: string;
  confirmNewPassword: string;
}
interface DeleteFormFieldsType {
  password: string;
};

const TITLE = "Account Settings";
const PAGE_TITLE = `${TITLE} | ${APP_NAME}`;

const AccountSettings = () => {
  const location = useLocation();
  const locationEncoded = encodeURIComponent(`${location.pathname}${location.search}`);
  const navigate = useNavigate();

  const updateAccountState = useSelector((state: RootState) => selectUpdateAccountState(state));

  const authContext = useContext(AuthContext);
  if (! authContext) throw new Error('No AuthContext provided');
  const { user, handleLogout, updateUser } = authContext;
  if (! user) throw new Error('No authenticated user provided');

  // -- button statuses
  const [deleteAccountStatus, setDeleteAccountStatus] = useState<ButtonStatus>('enabled');
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);

  const handleSubmitProfile = useCallback(
    ({ value }: { value: ProfileType, }) => {
      const {
        username,
      } = value;

      if (! username) {
        store.dispatch(setUpdateAccountPendingSubmission({
          error: {
            kind: 'user',
            reason: '"username" field cannot be empty',
          },
        }));
        return;
      }

      store.dispatch(setUpdateAccountSubmitting({
        payload: {
          username,
        },
      }));
    },
    []
  );// -- end handleSubmitProfile

  const profileForm = useForm({
    defaultValues: {
      username: user.username,
    },
    onSubmit: handleSubmitProfile,
    validators: {
      onChange({ value }) {
        const {
          username,
        } = value;

        if (! username) return "Username cannot be empty";
        if (username === user.username) return "Username not changed";

        return undefined;
      },
    },
  });

  const handleSubmitSecureFields = useCallback(
    ({ value }: { value: SecureFieldsType, }) => {
      if (user.kind !== 'permanent') {
        throw new Error('Non-permanent users cannot edit their accounts');
      }

      const {
        newEmail,
        confirmNewEmail,
        newPassword,
        confirmNewPassword,
      } = value;

      if (newEmail !== confirmNewEmail) {
        store.dispatch(setUpdateAccountPendingSubmission({
          error: {
            kind: 'user',
            reason: "Email fields don't match",
          },
        }));
        return;
      }

      if (newPassword !== confirmNewPassword) {
        store.dispatch(setUpdateAccountPendingSubmission({
          error: {
            kind: 'user',
            reason: "Password fields don't match",
          },
        }));
        return;
      }

      const payload : PatchPermanentUserReqPayloadInitial = ({});
      let nUpdatedFields = 0;

      if (newEmail && (newEmail !== user.email)) {
        payload.email = newEmail;
        ++nUpdatedFields;
      }

      if (newPassword) {
        payload.password = newPassword;
        ++nUpdatedFields;
      }

      if (nUpdatedFields === 0) {
        store.dispatch(setUpdateAccountPendingSubmission({
          error: {
            kind: 'user',
            reason: "No updated fields",
          },
        }));
      } else {
        store.dispatch(setUpdateAccountSubmitting({
          payload,
        }));
      }
    },
    [user]
  );// -- end handleSubmitSecureFields

  const securityForm = useForm({
    defaultValues: {
      newEmail: "",
      confirmNewEmail: "",
      newPassword: "",
      confirmNewPassword: "",
    },
    onSubmit: handleSubmitSecureFields,
  });

  const handleSubmitDeleteProfile = useCallback(
    async ({
      value,
    }: {
      value: DeleteFormFieldsType,
    }) => {
      setDeleteAccountStatus('pending');

      try {
        const res = await api.request({
          method: 'delete',
          url: "/users/me",
          data: {
            password: value.password
         },
        });

        if (res.status === 200) {
          handleLogout();
          console.log('User account deleted successfully.');
          toast.success('Account deleted successfully', {
            position: "bottom-center",
          });
          navigate('/');
        } else {
          console.error(`Account deletion failed ${res.status}:`, res.data);
          toast.error('Account deletion failed', {
            position: "bottom-center",
            hideProgressBar: true,
            closeOnClick: true,
            pauseOnHover: true,
            draggable: true,
            progress: undefined,
            theme: "colored",
            transition: Bounce,
          });
        }
      } catch (err: unknown) {
        const apiErr = err as AxiosError;

        console.error(err);

        if (apiErr.status === 401) {
          // -- redirect to login
          navigate(`/login?redirect=${locationEncoded}`);
        }
      } finally {
        setDeleteAccountStatus('enabled');
      }
    },
    [handleLogout, navigate, locationEncoded]
  );

  const deleteForm = useForm({
    defaultValues: { password: "" },
    onSubmit: handleSubmitDeleteProfile,
  });

  // -- Ensure userFlow state defaults to PendingSubmission before and after
  // page loads
  useEffect(
    () => {
      // -- If user if non-permanent, redirect user to auth page
      if (user.kind !== 'permanent') {
        toast.error('Non-permanent users cannot edit their accounts');
        navigate("/signup");
        return;
      }

      // -- Reset inputs to defaults
      profileForm.setFieldValue('username', user.username);
      securityForm.setFieldValue('newEmail', user.email);
      securityForm.setFieldValue('confirmNewEmail', user.email);
      securityForm.setFieldValue('newPassword', "");
      securityForm.setFieldValue('confirmNewPassword', "");

      // -- Set default user flow state
      store.dispatch(setUpdateAccountPendingSubmission({}));

      return () => {
        store.dispatch(setUpdateAccountPendingSubmission({}));
      };
    },
    [location, navigate, profileForm, securityForm, user]
  );// -- end useEffect

  // -- Handle updateAccount state transitions
  useEffect(
    (): () => void => {
      // -- Dummy unmount handler, to be returned by all branches;
      // will cause Typescript to flag any unhandled cases
      if (user.kind !== 'permanent') {
        throw new Error('Cannot update non-permanent user account');
      }

      const handleUnmount = () => {};

      switch (updateAccountState.status) {
        case 'pending_submission':
        {
          const {
            error,
          } = updateAccountState;

          // -- Display error notification, if any
          if (error?.reason) {
            toast.error(error.reason);
          }

          return handleUnmount;
        }
        case 'submitting':
        {
          const {
            payload,
          } = updateAccountState;

          const reqBody : PatchPermanentUserInitialReqBody = ({
            kind: 'initial',
            payload,
          });

          api.patch<PatchPermanentUserResBody>("/users/me", reqBody)
            .then((res) => {
              switch (res.data.kind) {
                case 'confirmed':
                  store.dispatch(setUpdateAccountConfirmed({
                    userData: res.data.payload,
                  }));
                  break;
                case 'pending_confirmation':
                  store.dispatch(setUpdateAccountPendingConfirmation({
                    email: res.data.email,
                  }));
                  break;
              }// -- end switch (res.status)
            })
            .catch((e: AxiosError) => {
              console.error('Call to PATCH /users/me failed with status', e.status);

              if ((! e.status) || (e.status >= 500)) {
                store.dispatch(setUpdateAccountPendingSubmission({
                  error: {
                    kind: 'system',
                    reason: 'Could not update account: unexpected server error',
                  },
                }));
              } else {
                switch (e.status) {
                  case 401:
                    // -- Authorization unavailable/expired
                    handleLogout();
                    navigate("/login");
                    break;
                  case 403:
                    store.dispatch(setUpdateAccountPendingSubmission({
                      error: {
                        kind: 'user',
                        reason: 'You are not authorized to perform this update',
                      },
                    }));
                    break;
                  case 429:
                    store.dispatch(setUpdateAccountPendingSubmission({
                      error: {
                        kind: 'system',
                        reason: "Too many requests; please try again later",
                      },
                    }));
                    break;
                  default:
                    store.dispatch(setUpdateAccountPendingSubmission({
                      error: {
                        kind: 'user',
                        reason: 'Update failed: bad request',
                      },
                    }));
                    break;
                }// -- end switch (e.status)
              }
            });

            return handleUnmount;
        }
        case 'pending_confirmation':
        {
          const {
            error,
          } = updateAccountState;

          // -- Display error, if necessary
          if (error?.reason) {
            toast.error(error.reason);
          }

          return handleUnmount;
        }
        case 'requesting_confirmation':
        {
          const {
            email,
            confirmationToken,
          } = updateAccountState;

          const reqBody : PatchPermanentUserConfirmReqBody = ({
            kind: 'confirm',
            payload: confirmationToken,
          });

          api.patch<PatchPermanentUserResBody>('/users/me', reqBody)
            .then((res) => {
              switch (res.data.kind) {
                case 'pending_confirmation':
                  throw new Error('Unexpected response type "pending_confirmation"');
                case 'confirmed':
                {
                  store.dispatch(setUpdateAccountConfirmed({
                    userData: res.data.payload,
                  }));
                }
                break;
              }// -- end switch (res.data.kind)
            })
            .catch((e: AxiosError) => {
              console.error('Call to PATCH /users/me failed with status', e.status);

              if ((! e.status) || (e.status >= 500)) {
                store.dispatch(setUpdateAccountPendingConfirmation({
                  email,
                  error: {
                    kind: 'system',
                    reason: 'Could not update account: unexpected server error',
                  },
                }));
              } else {
                switch (e.status) {
                  case 401:
                    // -- Authorization unavailable/expired
                    handleLogout();
                    navigate("/login");
                    break;
                  case 403:
                    store.dispatch(setUpdateAccountPendingConfirmation({
                      email,
                      error: {
                        kind: 'user',
                        reason: 'You are not authorized to perform this update',
                      },
                    }));
                    break;
                  case 429:
                    store.dispatch(setUpdateAccountPendingConfirmation({
                      email,
                      error: {
                        kind: 'system',
                        reason: "Too many requests; please try again later",
                      },
                    }));
                    break;
                  default:
                    store.dispatch(setUpdateAccountPendingConfirmation({
                      email,
                      error: {
                        kind: 'user',
                        reason: 'Update failed: bad request',
                      },
                    }));
                    break;
                }// -- end switch (e.status)
              }
            });

          return handleUnmount;
        }
        case 'confirmed':
        {
          const {
            userData,
          } = updateAccountState;

          // -- Notify user of success
          toast.success("Account updated successfully");

          // -- update authed user
          updateUser({
            ...user,
            ...userData,
          });

          // -- reset user flow state
          store.dispatch(setUpdateAccountPendingSubmission({}));
          return handleUnmount;
        }
      }// -- end switch (updateAccountState.status)

      // -- DON'T put a final return statement here. All return statements should
      // be placed within the switch statement, so that Typescript will flag any
      // unhandled branches.
    },
    [updateAccountState, navigate, user, updateUser, handleLogout]
  );// -- end useEffect

  const handleSubmitConfirmUpdate = useCallback(
    (req: ConfirmUpdateModalPayload) => {
      switch (updateAccountState.status) {
        case 'pending_confirmation':
        {
          const {
            email,
          } = updateAccountState;
          const {
            payload,
          } = req;

          store.dispatch(setUpdateAccountRequestingConfirmation({
            email,
            confirmationToken: payload,
          }));
        }
        break;
        default:
          throw new Error(
            `Cannot submit update confirmation in state "${updateAccountState.status}"`
          );
      }// -- end switch (updateAccountState.status)
    },
    [updateAccountState]
  );// -- end handleSubmitConfirmUpdate

  const handleSkipConfirmUpdate = useCallback(
    () => {
      switch (updateAccountState.status) {
        case 'pending_confirmation':
        {
          store.dispatch(setUpdateAccountPendingSubmission({}));
        }
        break;
        default:
          throw new Error(
            `Cannot skip confirmation in status "${updateAccountState.status}"`
          );
      }// -- end switch (updateAccountState.status)
    },
    [updateAccountState]
  );// -- end handleSkipConfirmUpdate

  const getUpdateProfileStatus = useCallback(
    (formData: ProfileType): ButtonStatus => {
      const {
        username,
      } = formData;

      switch (updateAccountState.status) {
        case 'pending_submission':
        {
          if (username && (username !== user.username)) {
            return "enabled";
          } else {
            return "disabled";
          }
        }
        case 'submitting':
        {
          const {
            payload,
          } = updateAccountState;

          if (payload.username) {
            return "pending";
          } else {
            return "disabled";
          }
        }
        default:
          return "disabled";
      }// -- end switch (updateAccountState.status)
    },
    [updateAccountState, user]
  );// -- end getUpdateProfileStatus

  const getUpdateSecuritySettingsStatus = useCallback(
    (formData: SecureFieldsType): ButtonStatus => {
      if (user.kind !== 'permanent') {
        throw new Error("Cannot update accounts of non-permanent users");
      }

      const {
        newEmail,
        confirmNewEmail,
        newPassword,
        confirmNewPassword,
      } = formData;

      switch (updateAccountState.status) {
        case 'pending_submission':
        {
          if (newEmail !== confirmNewEmail) return "disabled";
          if (newPassword !== confirmNewPassword) return "disabled";

          if (newEmail.trim() && (newEmail !== user.email)) return "enabled";
          if (newPassword.trim().length >= 8) return "enabled";

          return "disabled";
        }
        case 'submitting':
        {
          const {
            payload,
          } = updateAccountState;

          if (payload.email || payload.password) {
            return "pending";
          } else {
            return "disabled";
          }
        }
        default:
          return "disabled";
      }// -- end switch (updateAccountState.status)
    },
    [updateAccountState, user]
  );// -- end getUpdateSecuritySettingsStatus

  return (
    <Page
      title={PAGE_TITLE}
    >
      <HeaderAuthed
        title={TITLE}
      />

      <div className="flex flex-row justify-center">
        <div className="p-6 space-y-6 min-w-3xl w-1/2">
          {/* Basic Info */}
          <div className="border bg-card-background rounded-lg p-6">
            <form onSubmit={(ev: React.FormEvent<HTMLFormElement>) => {
              ev.preventDefault();
              profileForm.handleSubmit(ev);
            }} className="space-y-4">
              <profileForm.Field name="username">
                {(field) => (
                  <>
                    <label
                      htmlFor={field.name}
                    >
                      Username
                    </label>
                    <input
                      className="border rounded p-2 w-full"
                      value={field.state.value}
                      placeholder="Your username"
                      onChange={(e) => field.handleChange(e.target.value)}
                    />
                  </>
                )}
              </profileForm.Field>

              <profileForm.Subscribe>
                {({ values }) => {
                  const buttonStatus = getUpdateProfileStatus(values);

                  return (
                    <Button
                      type="submit"
                      status={buttonStatus}
                      className="px-4 py-2 bg-page-background border text-white rounded"
                    >
                      Update Profile
                    </Button>
                  );
                }}
              </profileForm.Subscribe>
            </form>
          </div>

          {/* Security Settings */}
          <div className="border bg-card-background rounded-lg p-6 flex flex-col gap-2">
            <h2 className="text-lg font-semibold mb-4">Security Settings</h2>
            <p>Changing these settings requires confirmation via email.</p>

            <form onSubmit={(ev: React.FormEvent<HTMLFormElement>) => {
              ev.preventDefault();
              securityForm.handleSubmit(ev);
            }} className="space-y-4">
              <securityForm.Field name="newEmail">
                {(field) => (
                  <>
                    <label
                      htmlFor={field.name}
                    >
                      Email Address
                    </label>
                    <input
                      type="email"
                      className="border rounded p-2 w-full"
                      placeholder="Your email"
                      value={field.state.value}
                      onChange={(e) => field.handleChange(e.target.value)}
                    />
                  </>
                )}
              </securityForm.Field>
              <securityForm.Field name="confirmNewEmail">
                {(field) => (
                  <>
                    <label
                      htmlFor={field.name}
                    >
                      Confirm New Email Address
                    </label>
                    <input
                      type="email"
                      className="border rounded p-2 w-full"
                      placeholder="Your email"
                      value={field.state.value}
                      onChange={(e) => field.handleChange(e.target.value)}
                    />
                  </>
                )}
              </securityForm.Field>
              <securityForm.Field name="newPassword">
                {(field) => (
                  <>
                    <label
                      htmlFor={field.name}
                    >
                      New Password
                    </label>
                    <input
                      type="password"
                      placeholder="New password"
                      className="border rounded p-2 w-full"
                      value={field.state.value}
                      onChange={(e) => field.handleChange(e.target.value)}
                    />
                  </>
                )}
              </securityForm.Field>
              <securityForm.Field name="confirmNewPassword">
                {(field) => (
                  <>
                    <label
                      htmlFor={field.name}
                    >
                      Confirm New Password
                    </label>
                    <input
                      type="password"
                      placeholder="Confirm new password"
                      className="border rounded p-2 w-full"
                      value={field.state.value}
                      onChange={(e) => field.handleChange(e.target.value)}
                    />
                  </>
                )}
              </securityForm.Field>

              <securityForm.Subscribe>
                {({ values }) => {
                  const buttonStatus = getUpdateSecuritySettingsStatus(values);

                  return (
                    <Button
                      type="submit"
                      status={buttonStatus}
                      className="px-4 py-2 bg-page-background border text-white rounded"
                    >
                      Update Security Settings
                    </Button>
                  );
                }}
              </securityForm.Subscribe>
            </form>
          </div>

          {/* Danger Zone */}
          <div className="border border-red-300 bg-card-background rounded-lg p-6">
            <h2 className="text-lg font-semibold text-red-600 mb-4">Danger Zone</h2>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                setDeleteConfirmOpen(true);
              }}
            >
              <deleteForm.Field name="password">
                {(field) => (
                  <input
                    type="password"
                    placeholder="Enter your password to confirm"
                    className="border rounded p-2 w-full mb-4"
                    value={field.state.value}
                    onChange={(e) => field.handleChange(e.target.value)}
                  />
                )}
              </deleteForm.Field>
              <Button
                type="submit"
                status={deleteAccountStatus}
                className="px-4 py-2 bg-red-600 text-white rounded"
              >
                Delete Account
              </Button>
            </form>

            <AppModal
              open={deleteConfirmOpen}
              onOpenChange={setDeleteConfirmOpen}
              title="Are you sure?"
              description="This action is irreversible. All your data will be lost."
              footer={
                <>
                  <Button
                    variant="secondary"
                    onClick={() => setDeleteConfirmOpen(false)}
                  >
                    Cancel
                  </Button>
                  <Button
                    variant="destructive"
                    onClick={() => {
                      deleteForm.handleSubmit();
                      setDeleteConfirmOpen(false);
                    }}
                  >
                    Confirm
                  </Button>
                </>
              }
            />
          </div>
        </div>
      </div>

      {/** Modal for confirming account updates via token **/}
      {(() => {
        switch (updateAccountState.status) {
          case 'pending_confirmation':
          case 'requesting_confirmation':
          {
            const initToken = (updateAccountState.status === 'pending_confirmation') ?
              updateAccountState.initConfirmationToken
              : undefined;
            let variant : GetFieldType<ConfirmUpdateModalProps, 'variant'>;
            switch (updateAccountState.status) {
              case 'pending_confirmation':
                if (updateAccountState.error?.kind === 'user') {
                  variant = "error";
                } else {
                  variant = "normal";
                }
                break;
              case 'requesting_confirmation':
                variant = "pending";
                break;
            }// -- end switch (updateAccountState.status)

            return (
              <ConfirmUpdateModal
                open={true}
                email={updateAccountState.email}
                initToken={initToken}
                variant={variant}
                onSubmit={handleSubmitConfirmUpdate}
                onSkip={handleSkipConfirmUpdate}
              />
            );
          }
          default:
            return null;
        }// -- end switch (updateAccountState.status)
      })()}

      <Footer />
    </Page>
  );
};// -- end AccountSettings

export default AccountSettings;
