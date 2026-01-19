// -- std imports
import {
  useState
} from 'react';

// -- third-party imports
import {
  X
} from 'lucide-react';

// -- local imports

import {
  USER_PERMISSION_TYPES,
  type UserPermission,
  type UserPermissionEnum
} from '@/types/APIProtocol';

import {
  Button
} from '@/components/ui/button';

import {
  Input
} from '@/components/ui/input';

export interface ShareWhiteboardFormData {
  userPermissions: UserPermission[];
}

export interface ShareWhiteboardFormProps {
  initUserPermissions: UserPermission[];
  onSubmit: (data: ShareWhiteboardFormData) => void;
}

const ShareWhiteboardForm = ({
  initUserPermissions,
  onSubmit
}: ShareWhiteboardFormProps): React.JSX.Element => {
  // -- prop-derived state
  const initPermissionsByEmail: Record<string, UserPermission> = Object.fromEntries(
    initUserPermissions.map(perm => {
      switch (perm.type) {
        case 'email':
          return [perm.email, perm];
        default:
          return [perm.user.email, perm];
      }
    })
  );

  // -- managed state
  const [permissionsByEmail, setPermissionsByEmail] = useState<Record<string, UserPermission>>(
    initPermissionsByEmail
  );
  const [newEmail, setNewEmail] = useState<string>("");
  const [newUserPermType, setNewUserPermType] = useState<UserPermissionEnum>(
    USER_PERMISSION_TYPES[0] as UserPermissionEnum
  );

  // -- derived state
  const permissions: UserPermission[] = Object.values(permissionsByEmail);

  const handleChangeNewEmail = (ev: React.ChangeEvent<HTMLInputElement>) => {
    ev.preventDefault();
    setNewEmail(ev.target.value);
  };

  const handleChangePermType = (ev: React.ChangeEvent<HTMLSelectElement>) => {
    ev.preventDefault();
    setNewUserPermType(ev.target.value as UserPermissionEnum);
  };

  const handleAddNewEmail = (ev: React.MouseEvent<HTMLButtonElement>) => {
    ev.preventDefault();

    setNewEmail(newEmail => {
      if (newEmail) {
        setPermissionsByEmail(prev => ({
          ...prev,
          [newEmail]: ({
            type: 'email',
            email: newEmail,
            permission: newUserPermType
          })
        }));
      }

      return "";
    });
  };

  const makeHandleRemoveEmail = (email: string) => () => {
    setPermissionsByEmail(prev => {
      const next = ({ ...prev });

      delete next[email];

      return next;
    });
  };

  const RemovablePermission = (perm: UserPermission): React.JSX.Element => {
    // as an entry in a table
    const email: string = perm.type === 'email' ? perm.email : perm.user.email;
    const username: string = perm.type === 'user' ? perm.user.username : '-';
    const { permission } = perm;

    return (
      <tr key={email}>
        <td className="text-center">{email}</td>
        <td className="text-center">{username}</td>
        <td className="text-center">{permission}</td>
        <td className="text-center">
          <button
            onClick={makeHandleRemoveEmail(email)}
            className="hover:cursor-pointer p-1 inline-block align-middle"
          >
            <X size={18} />
          </button>
        </td>
      </tr>
    );
  };

  const handleSubmit = (ev: React.FormEvent<HTMLFormElement>) => {
    ev.preventDefault();

    const data: ShareWhiteboardFormData = ({
      userPermissions: Object.values(permissionsByEmail)
    });

    onSubmit(data);
  };

  return (
    <div className="w-200 p-0 m-4 mt-0 flex flex-col flex-shrink">
      <form onSubmit={handleSubmit}>
        <h2 className="text-center text-2xl font-bold m-2">Update User Permissions</h2>

        <div className="flex flex-col flex-shrink p-4">
          <h3 className="text-lg font-semibold">
            Invite collaborators by email
          </h3>

          <div
            className="flex flex-row align-text-bottom w-full"
          >
            <Input
              name="new-email"
              type="email"
              placeholder="Email"
              onChange={handleChangeNewEmail}
              value={newEmail}
              className="mr-2 grow"
            />

            <label
              htmlFor="permission-type"
              className="mr-2 grow"
            >
              Permission:
            </label>
            <select
              name="permission-type"
              value={newUserPermType}
              onChange={handleChangePermType}
              className="hover:cursor-pointer mr-2"
            >
              {USER_PERMISSION_TYPES.map(perm => (
                <option key={perm} value={perm}>{perm}</option>
              ))}
            </select>

            <Button
              variant="secondary"
              onClick={handleAddNewEmail}
            >
              + Add Collaborator
            </Button>
          </div>

          <div>
            {/** Display user emails to add, with option to remove **/}
            <h3 className="text-lg font-semibold my-2">
              Collaborators to invite:
            </h3>
            <table className="w-full">
              <thead>
                <tr>
                  <th>
                    Email
                  </th>
                  <th>
                    Username
                  </th>
                  <th>
                    Permission
                  </th>
                  <th>
                    Delete
                  </th>
                </tr>
              </thead>
              <tbody>
                {permissions.map(perm => RemovablePermission(perm)) }
              </tbody>
            </table>
            {
              permissions.length < 1 && <span>No user permissions created</span>
            }
          </div>
        </div>

        <div className="flex flex-row justify-center">
          <Button
            type="submit"
            className="w-1/2"
          >
            Update User Permissions
          </Button>
        </div>
      </form>
    </div>
  );
};

export default ShareWhiteboardForm;
