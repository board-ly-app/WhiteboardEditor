// -- std imports
import {
  useState,
  useCallback,
} from 'react';

// -- third-party imports
import {
  X,
} from 'lucide-react';

// -- local imports

import {
  USER_PERMISSION_TYPES,
  type UserPermission,
  type UserPermissionEnum
} from '@/types/APIProtocol';

// -- ui
import {
  Popover,
  PopoverContent,
  PopoverTrigger
} from "@/components/ui/popover";

import {
  Command,
} from '@/components/ui/command';

import {
  Button,
  type ButtonStatus,
} from '@/components/ui/button';

import {
  Input
} from '@/components/ui/input';

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

interface CreateWhiteboardFormAttribs {
  name: string;
}

const FORM_ATTRIBS_DEFAULT = {
  name: ''
};

export interface CreateWhiteboardFormData extends CreateWhiteboardFormAttribs {
  collaboratorPermissions: UserPermission[];
  width: number;
  height: number;
}

export interface CreateWhiteboardModalProps {
  onSubmit: (data: CreateWhiteboardFormData) => Promise<unknown>;
}

const CreateWhiteboardModal = ({
  onSubmit
}: CreateWhiteboardModalProps): React.JSX.Element => {
  // -- managed state
  const [isOpen, setIsOpen] = useState<boolean>();
  const [newEmail, setNewEmail] = useState<string>("");
  const [formInputs, setFormInputs] = useState<CreateWhiteboardFormAttribs>({
    ...FORM_ATTRIBS_DEFAULT
  });
  const [newUserPermType, setNewUserPermType] = useState<UserPermissionEnum>(
    USER_PERMISSION_TYPES[0]
  );
  const [permissionsByKey, setPermissionsByKey] = useState<Record<string, UserPermission>>({});

  const [submitButtonStatus, setSubmitButtonStatus] = useState<ButtonStatus>('enabled');

  // -- derived state
  const permissions: UserPermission[] = Object.values(permissionsByKey);

  const handleChangeNewEmail = (ev: React.ChangeEvent<HTMLInputElement>) => {
    ev.preventDefault();
    setNewEmail(ev.target.value);
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

  const handleOpenModal = () => {
    setIsOpen(true);
  };

  const handleChangeInput = (ev: React.ChangeEvent<HTMLInputElement>) => {
    ev.preventDefault();

    const name = ev.target.name
    const value = ev.target.value;

    setFormInputs(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleChangePermType = useCallback(
    (value: string) => {
      setNewUserPermType(value as UserPermissionEnum);
    },
    [setNewUserPermType]
  );

  const handleSubmit = useCallback(
    (ev: React.FormEvent<HTMLFormElement>) => {
      ev.preventDefault();

      setSubmitButtonStatus('pending');

      // Possibly useful when implementing custom scrolling
      // const windowWidth = window.innerWidth;
      // const windowHeight = window.innerHeight;
      const rootCanvasWidth = 3000;
      const rootCanvasHeight = 3000;

      const data = {
        ...formInputs,
        collaboratorPermissions: permissions,
        width: rootCanvasWidth,
        height: rootCanvasHeight,
      };

      if (! data.name) {
        alert('Name required');
        return;
      }

      onSubmit(data)
        .then(() => {
          // -- reset state and close modal on success
          //    otherwise, we want to save the form state so the user can try
          //    again
          setIsOpen(false);
          setFormInputs({ ...FORM_ATTRIBS_DEFAULT });
        })
        .finally(() => {
          setSubmitButtonStatus('enabled');
        });
    },
    [setSubmitButtonStatus, formInputs, onSubmit, permissions]
  );

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

  return (
    <Popover
      modal
      open={isOpen}
      onOpenChange={setIsOpen}
    >
      <PopoverTrigger asChild>
        <Button
          size="lg"
          onClick={handleOpenModal}
          className="bg-header-button-background border-1 border-border hover:text-header-button-text-hover"
        >
          + New Whiteboard
        </Button>
      </PopoverTrigger>

      <PopoverContent className="md:w-160 md:ml-8 flex flex-col flex-shrink">
        <form onSubmit={handleSubmit}>
          <h2 className="text-center text-2xl font-bold m-2">Create a new whiteboard</h2>

          <Command className="flex flex-col flex-shrink p-4">
            <div className="flex flex-col">
              <label htmlFor="whiteboard-name">Whiteboard Name:</label>
              <Input
                name="name"
                type="text"
                onChange={handleChangeInput}
                value={formInputs.name}
                required
                placeholder="Whiteboard Name"
              />
            </div>
          </Command>

          <Command className="flex flex-col flex-shrink p-4">
            <h3 className="text-center text-xl font-semibold m-2">
              Collaborators
            </h3>

            <div className="flex flex-col flex-shrink p-4">
              <h4 className="text-md font-semibold my-2">
                Invite collaborators by email
              </h4>

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
                <Select value={newUserPermType} onValueChange={handleChangePermType}>
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
                <h4 className="text-md font-semibold my-2">
                  Collaborators to invite:
                </h4>
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
          </Command>

          <div className="flex flex-row justify-center mb-4">
            <Button
              type="submit"
              status={submitButtonStatus}
              className="md:w-1/2"
            >
              + Create Whiteboard
            </Button>
          </div>
        </form>
      </PopoverContent>
    </Popover>
  );
};

export default CreateWhiteboardModal;
