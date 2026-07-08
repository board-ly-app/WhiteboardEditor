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

import { AppModal } from '@/components/ui/app-modal';

export interface ShareWhiteboardFormData {
  userPermissions: UserPermission[];
}

export interface ShareWhiteboardFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
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
    <div className='grid grid-flow-row grid-rows-2 sm:grid-rows-1 grid-cols-10 text-center px-2 gap-2'>
      <div className='col-span-10 sm:col-start-2 sm:col-span-6 flex items-center justify-center rounded-md bg-page-background gap-2'>
        <div className="py-1 px-2 truncate">{username || FIELD_UNAVAILABLE}</div>
        <div className="py-1 px-2 truncate">{`<${email || FIELD_UNAVAILABLE}>`}</div>
      </div>
      <div className='col-span-10 sm:col-span-2 flex items-center justify-center sm:justify-start gap-2'>
        <div className="text-center">
          <Select value={permission} onValueChange={handleChangePermType}>
            <SelectTrigger id="permission-type" className="hover:cursor-pointer w-auto">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {USER_PERMISSION_TYPES.map(perm => (
                <SelectItem key={perm} value={perm}>{perm}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="text-center">
          <button
            type="button"
            onClick={() => onRemove(perm)}
            className="hover:cursor-pointer p-1 inline-block align-middle text-destructive"
          >
            <X size={18}/>
          </button>
        </div>
      </div>
    </div>
  );
};// -- end EditablePermission

const ShareWhiteboardForm = ({
  open,
  onOpenChange,
  initPermissionsByUserId,
  initPermissionsByEmail,
  onSubmit,
}: ShareWhiteboardFormProps): React.JSX.Element => {
  // -- Existing (but not committed) permissions
  const [permissionsByUserId, setPermissionsByUserId] = useState<Record<UserIdType, UserPermissionByUser>>(
    initPermissionsByUserId
  );
  const [permissionsByEmail, setPermissionsByEmail] = useState<Record<string, UserPermissionByEmail>>(
    initPermissionsByEmail
  );

  const userIdsByEmail : Record<string, UserIdType> = useMemo(
    () => {
      return Object.fromEntries(Object.entries(permissionsByUserId).map(([userId, perm]) => {
        switch (perm.user.kind) {
          case 'temp':
            return null;
          case 'permanent':
            return [perm.user.email, userId];
          default:
            throw new Error(`Unrecognized user type: ${perm.user}`);
        }// -- end switch (perm.user.kind)
      }).filter(entry => !!entry));
    },
    [permissionsByUserId]
  );// -- end const userIdsByEmail

  // -- New permission input state
  const [newEmail, setNewEmail] = useState<string>("");
  const [newUserPermType, setNewUserPermType] = useState<UserPermissionEnum>(
    USER_PERMISSION_TYPES[0] as UserPermissionEnum
  );
  const [buttonStatus, setButtonStatus] = useState<ButtonStatus>('enabled');

  // -- reset permissions to init permissions when the modal is opened
  useEffect(
    () => {
      if (open) {
        setPermissionsByUserId(initPermissionsByUserId);
        setPermissionsByEmail(initPermissionsByEmail);
      }
    },
    [
      open,
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
          if (newEmail in userIdsByEmail) {
            // -- Simply override existing user id permission
            setPermissionsByUserId((oldPermissions) => {
              const userId = userIdsByEmail[newEmail];
              const newPerm : UserPermissionByUser = {
                ...oldPermissions[userId],
                permission: newUserPermType,
              };

              return {
                ...oldPermissions,
                [userId]: newPerm,
              };
            });
          } else {
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
        }

        return "";
      });
    },
    [setNewEmail, setPermissionsByEmail, newUserPermType, userIdsByEmail]
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
    <AppModal
      open={open}
      onOpenChange={onOpenChange}
      title="Update User Permissions"
      className="sm:max-w-3xl"
      footer={
        <Button
          status={buttonStatus}
          onClick={handleSubmit}
          className='bg-card-background rounded-md border'
        >
          Update User Permissions
        </Button>
      }
    >
      <div className="flex flex-col flex-shrink bg-card-background rounded-lg border p-4">
        
        <h3 className="text-md text-start font-semibold">
          Invite collaborators by email
        </h3>
        <div className="grid grid-flow-cols grid-cols-2 gap-2">
          <div className="col-span-2 sm:col-span-1 w-full">
            <Input
              name="new-email"
              type="email"
              placeholder="Email"
              onChange={handleChangeNewEmail}
              value={newEmail}
              className="mr-2 grow"
            />
          </div>

          <div className='col-span-2 sm:col-span-1 flex justify-center items-center gap-2'>
            <label
              htmlFor="permission-type"
            >
              Permission:
            </label>

            <Select value={newUserPermType} onValueChange={handleChangePermType}>
              <SelectTrigger id="permission-type" className="hover:cursor-pointer w-auto">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {USER_PERMISSION_TYPES.map(perm => (
                  <SelectItem key={perm} value={perm}>{perm}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            <div className='text-center'>
              <Button
                type="button"
                className='border'
                variant="secondary"
                onClick={handleAddNewEmail}
              >
                + Add
              </Button>
            </div>
          </div>
        </div>

        <div>
          {/** Display user emails to add, with option to remove **/}
          <h3 className="text-md text-center font-semibold mt-3 mb-1">
            Collaborators:
          </h3>
          <div className='flex flex-col gap-4'>
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
          </div>
          {
            (userIdPermissionsSorted.length + emailPermissionsSorted.length) < 1 && (
              <span>No user permissions created</span>
            )
          }
        </div>
      </div>
    </AppModal>
  );
};

export default ShareWhiteboardForm;
