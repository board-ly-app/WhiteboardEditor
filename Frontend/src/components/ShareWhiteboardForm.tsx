// -- std imports
import {
  useState,
  useCallback,
  useEffect,
  useMemo,
} from 'react';

// -- third-party imports
import {
  X,
} from 'lucide-react';

// -- local imports
import {
  type UserIdType,
} from '@/types/WebSocketProtocol';

import {
  USER_PERMISSION_TYPES,
  type UserPermission,
  type UserPermissionEnum,
  type UserPermissionByUser,
  type UserPermissionByEmail,
} from '@/types/UserPermission';

import {
  type ButtonStatus,
  Button,
} from '@/components/ui/button';

import {
  Input,
} from '@/components/ui/input';

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

export interface ShareWhiteboardFormData {
  userPermissions: UserPermission[];
}

export interface ShareWhiteboardFormProps {
  isActive: boolean;
  initPermissionsByUserId: Record<UserIdType, UserPermissionByUser>;
  initPermissionsByEmail: Record<string, UserPermissionByEmail>;
  onSubmit: (data: ShareWhiteboardFormData) => Promise<unknown>;
}

const getKeyForPermission = (perm: UserPermission): string => {
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

  if (email) {
    return `email:${email}`;
  } else if (username) {
    return `username:${username}`;
  } else {
    throw new Error(
      `Either email or username must be present on permission in order to form unique ID`
    );
  }
};// -- end getKeyForPermission

interface EditablePermissionProps {
  perm: UserPermission;
  onChange: (perm: UserPermission) => unknown;
  onRemove: (perm: UserPermission) => unknown;
}// -- end interface EditablePermissionProps

const EditablePermission = ({
  perm,
  onChange,
  onRemove,
}: EditablePermissionProps): React.JSX.Element => {
  // as an entry in a table
  const FIELD_UNAVAILABLE = '-';

  let email : string | null;
  let username : string | null = null;

  const handleChangePermType = useCallback(
    (newPerm: UserPermissionEnum) => {
      onChange({
        ...perm,
        permission: newPerm,
      });
    },
    [perm, onChange]
  );// -- end handleChangePermType

  switch (perm.type) {
    case 'user':
      username = perm.user.username;

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

  const {
    permission,
  } = perm;

  return (
    <tr>
      <td className="text-center">{email || FIELD_UNAVAILABLE}</td>
      <td className="text-center">{username || FIELD_UNAVAILABLE}</td>
      <td className="flex flex-row justify-center">
        <Select value={permission} onValueChange={handleChangePermType}>
          <SelectTrigger id="permission-type" className="hover:cursor-pointer mr-2 w-auto">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {USER_PERMISSION_TYPES.map(perm => (
              <SelectItem key={perm} value={perm}>{perm}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </td>
      <td className="text-center">
        <button
          onClick={() => onRemove(perm)}
          className="hover:cursor-pointer hover:bg-gray-600 p-1 inline-block align-middle rounded-md"
        >
          <X size={18} />
        </button>
      </td>
    </tr>
  );
};// -- end EditablePermission

const ShareWhiteboardForm = ({
  isActive,
  initPermissionsByUserId,
  initPermissionsByEmail,
  onSubmit,
}: ShareWhiteboardFormProps): React.JSX.Element => {
  // -- managed state
  const [permissionsByUserId, setPermissionsByUserId] = useState<Record<UserIdType, UserPermissionByUser>>(
    initPermissionsByUserId
  );
  const [permissionsByEmail, setPermissionsByEmail] = useState<Record<string, UserPermissionByEmail>>(
    initPermissionsByEmail
  );
  const [newEmail, setNewEmail] = useState<string>("");
  const [newUserPermType, setNewUserPermType] = useState<UserPermissionEnum>(
    USER_PERMISSION_TYPES[0] as UserPermissionEnum
  );
  const [buttonStatus, setButtonStatus] = useState<ButtonStatus>('enabled');

  // -- reset permissions to init permissions when set from inactive to active
  useEffect(
    () => {
      if (isActive) {
        setPermissionsByUserId(initPermissionsByUserId);
        setPermissionsByEmail(initPermissionsByEmail);
      }
    },
    [
      isActive,
      setPermissionsByUserId,
      setPermissionsByEmail,
      initPermissionsByUserId,
      initPermissionsByEmail,
    ]
  );

  // -- derived state
  const userIdPermissionsSorted : UserPermission[] = useMemo(
    () => {
      const userIdPermissions = Object.values(permissionsByUserId);

      userIdPermissions.sort((a, b) => {
        if (a.user.username < b.user.username) {
          return -1;
        } else if (a.user.username === b.user.username) {
          return 0;
        } else {
          return 1;
        }
      });

      return userIdPermissions;
    },
    [permissionsByUserId]
  );// -- end const userIdPermissionsSorted
  
  const emailPermissionsSorted : UserPermission[] = useMemo(
    () => {
      const emailPermissions = Object.values(permissionsByEmail);

      emailPermissions.sort((a, b) => {
        if (a.email < b.email) {
          return -1;
        } else if (a.email === b.email) {
          return 0;
        } else {
          return 1;
        }
      });

      return emailPermissions;
    },
    [permissionsByEmail]
  );// -- end emailPermissionsSorted

  const handleChangeNewEmail = useCallback(
    (ev: React.ChangeEvent<HTMLInputElement>) => {
      ev.preventDefault();
      setNewEmail(ev.target.value);
    },
    [setNewEmail]
  );// -- end handleChangeNewEmail

  const handleChangePermType = useCallback(
    (value: UserPermissionEnum) => {
      setNewUserPermType(value);
    },
    [setNewUserPermType]
  );// -- end handleChangePermType

  const handleAddNewEmail = useCallback(
    (ev: React.MouseEvent<HTMLButtonElement>) => {
      ev.preventDefault();

      setNewEmail(newEmail => {
        if (newEmail) {
          setPermissionsByEmail((oldPerms) => {
            return {
              ...oldPerms,
              [newEmail]: {
                type: 'email',
                email: newEmail,
                permission: newUserPermType,
              },
            };
          });
        }

        return "";
      });
    },
    [setNewEmail, setPermissionsByEmail, newUserPermType]
  );// -- end handleAddNewEmail

  const removePermission = useCallback(
    (perm: UserPermission) => {
      switch (perm.type) {
        case 'user':
          setPermissionsByUserId((oldPerms) => {
            const {
              [perm.user.id]: _removedPerm,
              ...nextPerms
            } = oldPerms;

            return nextPerms;
          });
          break;
        case 'email':
          setPermissionsByEmail((oldPerms) => {
            const {
              [perm.email]: _removedPerm,
              ...nextPerms
            } = oldPerms;

            return nextPerms;
          });
          break;
      }// -- end switch (perm.type)
    },
    [setPermissionsByUserId, setPermissionsByEmail]
  );// -- end removePermission

  const handleChangePermission = useCallback(
    (perm: UserPermission) => {
      switch (perm.type) {
        case 'user':
          setPermissionsByUserId((oldPermissions) => {
            return {
              ...oldPermissions,
              [perm.user.id]: perm,
            };
          });
          break;
        case 'email':
          setPermissionsByEmail((oldPermissions) => {
            return {
              ...oldPermissions,
              [perm.email]: perm,
            };
          });
          break;
        default:
          throw new Error(`Unrecognized permission: ${perm}`);
      }// -- end switch (perm.type)
    },
    [setPermissionsByUserId, setPermissionsByEmail]
  );// -- end handleChangePermission

  const handleSubmit = useCallback(
    () => {
      const data: ShareWhiteboardFormData = ({
        userPermissions: [...userIdPermissionsSorted, ...emailPermissionsSorted],
      });

      setButtonStatus('pending');
      onSubmit(data)
        .finally(() => {
          setButtonStatus('enabled');
        });
    },
    [onSubmit, setButtonStatus, userIdPermissionsSorted, emailPermissionsSorted]
  );// -- end handleSubmit

  return (
    <div className="w-200 p-0 m-4 mt-0 flex flex-col flex-shrink">
      <h2 className="text-center text-2xl font-bold m-2">Update User Permissions</h2>

      <div className="flex flex-col flex-shrink p-4">
        <h3 className="text-lg font-semibold">
          Invite collaborators by email
        </h3>

        <div
          className="flex flex-row align-center w-full"
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
          <Select name="permission-type" value={newUserPermType} onValueChange={handleChangePermType}>
            <SelectTrigger id="permission-type" className="hover:cursor-pointer mr-2 w-auto">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {USER_PERMISSION_TYPES.map(perm => (
                <SelectItem key={perm} value={perm}>{perm}</SelectItem>
              ))}
            </SelectContent>
          </Select>

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
              {
                userIdPermissionsSorted.map(perm => (
                  <EditablePermission
                    key={getKeyForPermission(perm)}
                    perm={perm}
                    onChange={handleChangePermission}
                    onRemove={removePermission}
                  />
                ))
              }
              {
                emailPermissionsSorted.map(perm => (
                  <EditablePermission
                    key={getKeyForPermission(perm)}
                    perm={perm}
                    onChange={handleChangePermission}
                    onRemove={removePermission}
                  />
                ))
              }
            </tbody>
          </table>
          {
            (userIdPermissionsSorted.length + emailPermissionsSorted.length) < 1 && (
              <span>No user permissions created</span>
            )
          }
        </div>
      </div>

      <div className="flex flex-row justify-center">
        <Button
          status={buttonStatus}
          className="w-1/2"
          onClick={handleSubmit}
        >
          Update User Permissions
        </Button>
      </div>
    </div>
  );
};

export default ShareWhiteboardForm;
