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
  const initPermissionsByKey: Record<string, UserPermission> = Object.fromEntries(
    initUserPermissions.map(perm => {
      switch (perm.type) {
        case 'email':
        {
            const key = `email:${perm.email}`;

            return [key, perm];
        }
        case 'user':
        {
            switch (perm.user.kind) {
              case 'permanent':
              {
                  const key = `email:${perm.user.email}`;

                  return [key, perm];
              }
              case 'temp':
              {
                  const key = `username:${perm.user.username}`;

                  return [key, perm];
              }
              default:
                throw new Error(`Unrecognized user type: ${perm.user}`);
            }// -- end switch (perm.user.kind)
        }
        default:
          throw new Error(`Unrecognized permission type: ${perm}`);
      }
    })
  );

  // -- managed state
  const [permissionsByKey, setPermissionsByKey] = useState<Record<string, UserPermission>>(
    initPermissionsByKey
  );
  const [newEmail, setNewEmail] = useState<string>("");
  const [newUserPermType, setNewUserPermType] = useState<UserPermissionEnum>(
    USER_PERMISSION_TYPES[0] as UserPermissionEnum
  );

  // -- derived state
  const permissions: UserPermission[] = Object.values(permissionsByKey);

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
        setPermissionsByKey(prev => ({
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

  const makeHandleRemoveByKey = (key: string) => () => {
    setPermissionsByKey(prev => {
      const {
        [key]: _removed,
        ...filtered
      } = prev;

      return filtered;
    });
  };

  const RemovablePermission = (perm: UserPermission): React.JSX.Element => {
    // as an entry in a table
    const FIELD_UNAVAILABLE = '-';

    let email : string | null;
    switch (perm.type) {
      case 'user':
        switch (perm.user.kind) {
          case 'temp':
            email = null;
            break;
          case 'permanent':
            email = perm.user.email;
            break;
          default:
            throw new Error(`Unrecognized user format: ${perm.user}`);
        }
        break;
      case 'email':
        email = perm.email;
        break;
      default:
        throw new Error(`Unrecognized permission type: ${perm}`);
    }// -- end switch (perm.type)

    const username: string | null = perm.type === 'user' ? perm.user.username : null;

    const {
      permission,
    } = perm;

    let key : string;
    if (email) {
      key = `email:${email}`;
    } else if (username) {
      key = `username:${username}`;
    } else {
      throw new Error(
        `Either email or username must be present on permission in order to form unique ID`
      );
    }

    return (
      <tr key={key}>
        <td className="text-center">{email || FIELD_UNAVAILABLE}</td>
        <td className="text-center">{username || FIELD_UNAVAILABLE}</td>
        <td className="text-center">{permission}</td>
        <td className="text-center">
          <button
            onClick={makeHandleRemoveByKey(key)}
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
      userPermissions: Object.values(permissionsByKey)
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
