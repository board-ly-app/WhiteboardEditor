// -- std imports
import {
  useContext,
  useState,
  useEffect,
  useMemo,
  useCallback,
} from 'react';

// -- third-party imports
import lodash from 'lodash';

import {
  useSelector,
} from 'react-redux';

import {
  toast,
} from 'react-toastify';

import {
  type AxiosError,
} from 'axios';

// -- local imports
import {
  type UserIdType,
} from '@/types/WebSocketProtocol';

import {
  type UserPermissionEnum,
  type UserPermissionByUser,
  type UserPermissionByEmail,
} from '@/types/UserPermission';

import {
  type User,
} from '@/types/User';

import api from '@/api/axios';

import {
  type RootState,
} from '@/store';

import {
  selectPermissionsByUserByWhiteboard,
  selectPermissionsByEmailByWhiteboard,
} from '@/store/whiteboards/whiteboardsSelectors';

import WhiteboardContext from '@/context/WhiteboardContext';
import UserCacheContext from '@/context/UserCacheContext';

import ShareWhiteboardFormUI, {
  type ShareWhiteboardFormData
} from '@/components/ShareWhiteboardForm';

export interface ShareWhiteboardFormProps {
  isActive: boolean;
  onClose: () => unknown;
}// -- end interface ShareWhiteboardFormProps

export const ShareWhiteboardForm = ({
  isActive,
  onClose,
}: ShareWhiteboardFormProps): React.JSX.Element => {
  const whiteboardContext = useContext(WhiteboardContext);

  if (! whiteboardContext) {
    throw new Error('No WhiteboardContext provided');
  }

  const {
    whiteboardId,
  } = whiteboardContext;

  const userCacheContext = useContext(UserCacheContext);

  if (! userCacheContext) {
    throw new Error('No UserCacheContext provided');
  }

  const {
    getUserById,
  } = userCacheContext;

  const permissionsByUserId : Record<UserIdType, UserPermissionEnum> = useSelector(
    (state: RootState) => selectPermissionsByUserByWhiteboard(state, whiteboardId) || {},
    lodash.isEqual
  );

  const permissionsByEmail : Record<string, UserPermissionEnum> = useSelector(
    (state: RootState) => selectPermissionsByEmailByWhiteboard(state, whiteboardId) || {},
    lodash.isEqual
  );

  const [usersById, setUsersById] = useState<Record<UserIdType, User>>({});

  useEffect(
    () => {
      const updateUsersById = async () => {
        const userIds = Object.keys(permissionsByUserId);

        const nextUsersById : Record<UserIdType, User> = Object.fromEntries(
          await Promise.all(userIds.map(
            async (userId) => [userId, await getUserById(userId)]
          ))
        );

        setUsersById(nextUsersById);
      };// -- end updateUsersById

      updateUsersById();
    },
    [permissionsByUserId, getUserById]
  );

  const initPermissionsByUserId: Record<UserIdType, UserPermissionByUser> = useMemo(
    () => {
      return Object.fromEntries(Object.entries(usersById).map(([userId, user]) => {
        if (! (userId in permissionsByUserId)) {
          throw new Error(`User id ${userId} not found in permissionsByUserId`);
        }

        return [
          userId,
          {
            type: 'user',
            user,
            permission: permissionsByUserId[userId],
          }
        ];
      }));
    },
    [usersById, permissionsByUserId]
  );// -- end const initPermissionsByUserId

  const initPermissionsByEmail : Record<string, UserPermissionByEmail> = useMemo(
    () => {
      return Object.fromEntries(
        Object.entries(permissionsByEmail).map(([email, perm]) => [
          email,
          ({
            type: 'email',
            email,
            permission: perm,
          })
        ])
      );
    },
    [permissionsByEmail]
  );// -- end const initPermissionsByEmail

  const handleSubmit = useCallback(
    async (data: ShareWhiteboardFormData) => {
      try {
        const {
          userPermissions
        } = data;

        const userPermissionsFinal = userPermissions.map(perm => {
          if (perm.type === 'user') {
            if ((typeof perm.user) === 'object') {
              // extract object id
              return ({
                ...perm,
                user: perm.user.id
              });
            } else {
              // already object id
              return perm;
            }
          } else {
            return perm;
          }
        });

        // -- make sure we have at least one owner
        if (! userPermissionsFinal.find(perm => perm.permission === 'own')) {
          // -- display popup alert
          toast.error('Whiteboard must have at least one owner.');

          return;
        }

        // No need for AxiosResp<..> type check, as response body
        // isn't used.
        await api.post(`/whiteboards/${whiteboardId}/user_permissions`, ({
          userPermissions: userPermissionsFinal
        }));

        // -- display popup alert
        toast.success('User permissions updated successfully');

        onClose();
      } catch (err: unknown) {
          const axiosErr = err as AxiosError<{ error: string; }>;

          console.error('POST /whiteboards/:id/user_permissions failed:', axiosErr);

          // -- display popup alert
          toast.error(`Share request failed: ${axiosErr.response?.data.error}`);

          // -- propagate error to caller
          throw err;
      }
    },
    [whiteboardId, onClose]
  );// -- end handleSubmit

  return (
    <ShareWhiteboardFormUI
      isActive={isActive}
      initPermissionsByUserId={initPermissionsByUserId}
      initPermissionsByEmail={initPermissionsByEmail}
      onSubmit={handleSubmit}
    />
  );
};// -- end ShareWhiteboardForm
