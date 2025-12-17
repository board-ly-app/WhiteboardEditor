import {
  useContext,
  useCallback,
} from "react";

import {
  useLocation,
  useNavigate,
} from 'react-router-dom';

import {
  useForm,
} from "@tanstack/react-form";

import {
  useModal,
} from "@/components/Modal";

import AuthContext from "@/context/AuthContext";
import HeaderAuthed from "@/components/HeaderAuthed";
import Page from '@/components/Page';
import api from '@/api/axios';

import {
  type AxiosResponse,
  type AxiosError,
} from 'axios';

import {
  APP_NAME,
} from '@/app.config';

import {
  type User,
} from '@/types/APIProtocol';
import Footer from "@/components/Footer";

// -- type definitions
type ProfileType = Pick<User, 'username'>;
type SecureFieldsType = Pick<User, 'email'> & {
  currentPassword: string;
  newPassword: string;
  confirmNewPassword: string;
};
type DeleteFormFieldsType = {
  password: string;
};

export default function AccountSettings() {
  const location = useLocation();
  const locationEncoded = encodeURIComponent(`${location.pathname}${location.search}`);
  const navigate = useNavigate();

  const { user, setUser } = useContext(AuthContext)!;
  const { Modal, openModal, closeModal } = useModal();

  const onSubmitProfile = useCallback(
    async ({
      value,
    }: {
      value: ProfileType,
    }) => {
      try {
        const res : AxiosResponse<User> = await api.patch("/users/me", {
          username: value.username,
        });

        if (res.status === 201) {
          const updated = res.data;
          setUser(updated);
          alert("Profile updated successfully!");
        }
      } catch (err: unknown) {
        const apiErr = err as AxiosError;

        console.error(err);

        if (apiErr.status === 403) {
          // redirect to login
          navigate(`/login?redirect=${locationEncoded}`);
        }
      }
    },
    [api, navigate, locationEncoded]
  );

  const profileForm = useForm({
    defaultValues: {
      username: user?.username || "",
    },
    onSubmit: onSubmitProfile,
  });

  const onSubmitSecureFields = useCallback(
    async ({
      value,
    }: {
      value: SecureFieldsType,
    }) => {
      try {
        const res : AxiosResponse<User> = await api.patch("/users/me", {
            email: value.email,
            password: value.newPassword,
            passwordConfirm: value.currentPassword
        });

        if (res.status === 201) {
          const updated = res.data;
          setUser(updated);
          alert("Security settings updated successfully!");
        }
      } catch (err: unknown) {
        const apiErr = err as AxiosError;

        console.error(err);

        if (apiErr.status === 403) {
          // redirect to login
          navigate(`/login?redirect=${locationEncoded}`);
        }
      }
    },
    [api, setUser, navigate, locationEncoded]
  );

  const securityForm = useForm({
    defaultValues: {
      email: user?.email || "",
      currentPassword: "",
      newPassword: "",
      confirmNewPassword: "",
    },
    onSubmit: onSubmitSecureFields,
  });

  const onSubmitDeleteProfile = useCallback(
    async ({
      value,
    }: {
      value: DeleteFormFieldsType,
    }) => {
      try {
        const res : AxiosResponse<User> = await api.patch("/users/me", {
          password: value.password
        });

        if (res.status === 201) {
          setUser(null);
          localStorage.removeItem("user");
          alert("Account deleted successfully");
        }
      } catch (err: unknown) {
        const apiErr = err as AxiosError;

        console.error(err);

        if (apiErr.status === 403) {
          // -- redirect to login
          navigate(`/login?redirect=${locationEncoded}`);
        }
      }
    },
    [api, setUser, navigate, locationEncoded]
  );

  const deleteForm = useForm({
    defaultValues: { password: "" },
    onSubmit: onSubmitDeleteProfile,
  });

  const title = "Account Settings";
  const pageTitle = `${title} | ${APP_NAME}`;

  return (
    <Page
      title={pageTitle}
    >
      <HeaderAuthed
        title={title}
      />

      <div className="flex flex-row justify-center">
        <div className="p-6 space-y-6 min-w-3xl w-1/2">
          {/* Basic Info */}
          <div className="border rounded-lg p-6">
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
              <button type="submit" className="px-4 py-2 bg-black text-white rounded">
                Update Profile
              </button>
            </form>
          </div>

          {/* Security Settings */}
          <div className="border rounded-lg p-6">
            <h2 className="text-lg font-semibold mb-4">Security Settings</h2>
            <form onSubmit={(ev: React.FormEvent<HTMLFormElement>) => {
              ev.preventDefault();
              securityForm.handleSubmit(ev);
            }} className="space-y-4">
              <securityForm.Field name="email">
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
              <securityForm.Field name="currentPassword">
                {(field) => (
                  <>
                    <label
                      htmlFor={field.name}
                      className="font-bold"
                    >
                      Required: Current Password
                    </label>
                    <input
                      type="password"
                      placeholder="Enter current password"
                      className="border rounded p-2 w-full"
                      value={field.state.value}
                      onChange={(e) => field.handleChange(e.target.value)}
                    />
                  </>
                )}
              </securityForm.Field>
              <button type="submit" className="px-4 py-2 bg-black text-white rounded">
                Update Security Settings
              </button>
            </form>
          </div>

          {/* Danger Zone */}
          <div className="border border-red-300 rounded-lg p-6">
            <h2 className="text-lg font-semibold text-red-600 mb-4">Danger Zone</h2>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                openModal();
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
              <button type="submit" className="px-4 py-2 bg-red-600 text-white rounded">
                Delete Account
              </button>
            </form>

            <Modal>
              <div className="p-6 flex flex-col justify-between h-full">
                <h3 className="text-lg font-semibold">Are you sure?</h3>
                <p className="text-sm text-gray-600">
                  This action is irreversible. All your data will be lost.
                </p>
                <div className="flex justify-end space-x-2 mt-4">
                  <button
                    className="px-4 py-2 bg-gray-200 rounded"
                    onClick={closeModal}
                  >
                    Cancel
                  </button>
                  <button
                    className="px-4 py-2 bg-red-600 text-white rounded"
                    onClick={() => {
                      deleteForm.handleSubmit();
                      closeModal();
                    }}
                  >
                    Confirm
                  </button>
                </div>
              </div>
            </Modal>
          </div>
        </div>
      </div>

      <Footer />
    </Page>
  );
}
