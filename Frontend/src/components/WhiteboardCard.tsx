// -- std imports
import {
  useContext,
  useCallback,
  useState,
  useMemo,
} from 'react';

import {
  Link,
} from 'react-router-dom';

// -- third-party imports
import {
  type AxiosError,
} from 'axios';

import {
  useQueryClient,
} from '@tanstack/react-query';

import {
  Bounce,
  toast,
} from 'react-toastify';

import { FilePen, Share, Trash2, X } from 'lucide-react';

// -- local imports
import api from '@/api/axios';

import {
  type Whiteboard,
} from '@/types/APIProtocol';

import {
  type UserPermissionEnum,
  type UserPermissionByUser,
  type UserPermissionByEmail,
} from '@/types/UserPermission';

import {
  type UserIdType,
} from '@/types/WebSocketProtocol';

import AuthContext from '@/context/AuthContext';

import {
  UserTagBrief,
  UserTagEmail,
} from '@/components/UserTag';

import {
  useModal,
} from '@/components/Modal';

import {
  DeleteWhiteboardForm,
} from '@/components/DeleteWhiteboardForm';

import {
  RenameWhiteboardForm,
} from '@/components/RenameWhiteboardForm';

import ShareWhiteboardForm, {
  type ShareWhiteboardFormData,
} from '@/components/ShareWhiteboardForm';

import {
  Button,
} from '@/components/ui/button';
import { WB_CARD_COLLABORATORS_DISPLAY_LIMIT } from '@/app.config';

export type WhiteboardProps = Whiteboard;

type ComponentVariant =
  | { name: 'own_whiteboard'; }
  | { name: 'shared_whiteboard'; }
;

function WhiteboardCard({
  id,
  name,
  user_permissions: userPermissions,
  thumbnail_url,
}: WhiteboardProps) {
  const queryClient = useQueryClient();

  const authContext = useContext(AuthContext);

  if (! authContext) {
    throw new Error('No AuthContext provided');
  }

  const {
    user,
  } = authContext;

  if (! user) {
    throw new Error('No authenticated user provided');
  }

  // -- rephrase permissions as the user's role
  const permissionTypeToUserRole = (perm: UserPermissionEnum): string => {
    switch (perm) {
      case 'view':
        return 'viewer';
      case 'edit':
        return 'editor';
      case 'own':
        return 'owner';
      default:
        // permission unaccounted for; should never happen
        throw new Error(`Permission unaccounted for: ${perm}`);
    }
  };

  const [expanded, setExpanded] = useState(false);

  const {
    Modal: RenameModal,
    openModal: openRenameModal,
    closeModal: closeRenameModal,
  } = useModal();

  const {
    Modal: ShareModal,
    openModal: openShareModal,
    closeModal: closeShareModal
  } = useModal();
  
  const {
    Modal: DeletionModal,
    openModal: openDeletionModal,
    closeModal: closeDeletionModal,
  } = useModal();

  const visiblePermissions = expanded
    ? userPermissions
    : userPermissions.slice(0, WB_CARD_COLLABORATORS_DISPLAY_LIMIT);
  const hiddenCount = Math.max(0, userPermissions.length - WB_CARD_COLLABORATORS_DISPLAY_LIMIT);

  // -- split permissions into the by-user-id / by-email structure the share form expects
  const initPermissionsByUserId = useMemo<Record<UserIdType, UserPermissionByUser>>(
    () => Object.fromEntries(
      userPermissions
        .filter((perm): perm is UserPermissionByUser => perm.type === 'user')
        .map(perm => [perm.user.id, perm])
    ),
    [userPermissions]
  );

  const initPermissionsByEmail = useMemo<Record<string, UserPermissionByEmail>>(
    () => Object.fromEntries(
      userPermissions
        .filter((perm): perm is UserPermissionByEmail => perm.type === 'email')
        .map(perm => [perm.email, perm])
    ),
    [userPermissions]
  );

  // -- miscellaneous callback functions
  const handleSubmitDeleteWhiteboard = useCallback(
    async () => {
      try {
        await api.delete(`/whiteboards/${id}`);

        console.log('Whiteboard', id, 'deleted successfully');

        // make sure list of own whiteboards is refreshed
        queryClient.invalidateQueries({
          queryKey: [user.id, 'dashboard', 'whiteboards', 'own'],
        });

        toast.success(`Whiteboard ${id} deleted successfully`, {
          position: "bottom-center",
          hideProgressBar: true,
          closeOnClick: true,
          pauseOnHover: true,
          draggable: true,
          progress: undefined,
          theme: "colored",
          transition: Bounce,
        });
      } catch (err: unknown) {
        const e = err as AxiosError;

        console.error(`FAILED TO DELETE WHITEBOARD (${e.code}): ${JSON.stringify(e.response, null, 2)}`);
        toast.error(`Error fetching whiteboard: ${e}`, {
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
    },
    [id, queryClient, user.id]
  );// -- end handleSubmitDeleteWhiteboard

  const handleSubmitRenameWhiteboard = useCallback(
    async (newName: string) => {
      try {
        await api.put(`/whiteboards/${id}/newName`, ({
          newName,
        }));

        // make sure list of own whiteboards is refreshed
        queryClient.invalidateQueries({
          queryKey: [user.id, 'dashboard', 'whiteboards', 'own'],
        });

        toast.success('Whiteboard renamed successfully', {
          position: "bottom-center",
          hideProgressBar: true,
          closeOnClick: true,
          pauseOnHover: true,
          draggable: true,
          progress: undefined,
          theme: "colored",
          transition: Bounce,
        });

        closeRenameModal();
      } catch (err: unknown) {
        const e = err as AxiosError<{ message?: string; }>;

        console.error(`FAILED TO RENAME WHITEBOARD (${e.code}): ${JSON.stringify(e.response, null, 2)}`);
        toast.error(`Error renaming whiteboard: ${e.response?.data?.message ?? e.message}`, {
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
    },
    [id, queryClient, user.id, closeRenameModal]
  );// -- end handleSubmitRenameWhiteboard

  const handleSubmitShareWhiteboard = useCallback(
    async (data: ShareWhiteboardFormData) => {
      try {
        const {
          userPermissions: updatedPermissions,
        } = data;

        const userPermissionsFinal = updatedPermissions.map(perm => {
          if (perm.type === 'user' && (typeof perm.user) === 'object') {
            // extract object id
            return ({
              ...perm,
              user: perm.user.id,
            });
          }

          return perm;
        });

        // -- make sure we have at least one owner
        if (! userPermissionsFinal.find(perm => perm.permission === 'own')) {
          toast.error('Whiteboard must have at least one owner.', {
            position: "bottom-center",
            hideProgressBar: true,
            closeOnClick: true,
            pauseOnHover: true,
            draggable: true,
            progress: undefined,
            theme: "colored",
            transition: Bounce,
          });

          return;
        }

        await api.post(`/whiteboards/${id}/user_permissions`, ({
          userPermissions: userPermissionsFinal,
        }));

        toast.success('User permissions updated successfully', {
          position: "bottom-center",
          autoClose: 5000,
          hideProgressBar: false,
          closeOnClick: true,
          pauseOnHover: true,
          draggable: true,
          progress: undefined,
          theme: "colored",
          transition: Bounce,
        });

        // make sure list of own whiteboards is refreshed
        queryClient.invalidateQueries({
          queryKey: [user.id, 'dashboard', 'whiteboards', 'own'],
        });

        closeShareModal();
      } catch (err: unknown) {
        const e = err as AxiosError<{ error?: string; }>;

        console.error('POST /whiteboards/:id/user_permissions failed:', e);
        toast.error(`Share request failed: ${e.response?.data?.error ?? e.message}`, {
          position: "bottom-center",
          hideProgressBar: true,
          closeOnClick: true,
          pauseOnHover: true,
          draggable: true,
          progress: undefined,
          theme: "colored",
          transition: Bounce,
        });

        // -- propagate error to caller so the form can reset its button state
        throw err;
      }
    },
    [id, queryClient, user.id, closeShareModal]
  );// -- end handleSubmitShareWhiteboard

  const isOwnWhiteboard = userPermissions.find(
    perm => (
      perm.type === 'user'
      && perm.user.id === user.id
      && perm.permission === 'own'
    )
  );
  let variant : ComponentVariant;

  if (isOwnWhiteboard) {
    variant = { name: 'own_whiteboard' };
  } else {
    variant = { name: 'shared_whiteboard' };
  }

  return (
    <>
      <div
        className="flex flex-col w-69 rounded-xl border-1 border-border shadow-2xl bg-card-background"
      >
        <Link
          key={id}
          to={`/whiteboard/${id}`}
          className="hover:bg-button-hover rounded-t-xl"
        >
          <img
            className={`rounded-t-xl w-full h-46 bg-canvas-background ${
              thumbnail_url ? 'object-contain' : 'object-cover'
            }`}
            src={thumbnail_url || "/images/testThumbnail.png"}
            alt="Whiteboard Thumbnail"
          />
          <div className="px-5 py-3 bg-page-background border-b">
            <h1 
              className="text-md text-h2-text font-bold truncate" 
              title={name}
            >
              {name}
            </h1>
          </div>
        </Link>

        {/** Collaborators — outside Link so the expand toggle doesn't navigate **/}
        <div className="p-2 flex-1">
          <h3 className="text-sm text-h3-text ps-2">Collaborators:</h3>
          <ul className="flex flex-col gap-1 mt-1">
            {visiblePermissions.map(perm => {
              if (perm.type === 'user') {
                if ((typeof perm.user) !== 'object') {
                  throw new Error(`User must be object; received ${perm.user}`);
                }

                return (
                  <li key={`user:${perm.user.id}`}>
                    <UserTagBrief
                      size="xsmall"
                      user={perm.user}
                      note={
                        <span> ({permissionTypeToUserRole(perm.permission)})</span>
                      }
                      className="max-w-full"
                    />
                  </li>
                );
              } else {
                return (
                  <li key={`email:${perm.email}`}>
                    <UserTagEmail
                      size="xsmall"
                      email={perm.email}
                      note={
                        <span> ({permissionTypeToUserRole(perm.permission)})</span>
                      }
                      className="max-w-full"
                    />
                  </li>
                );
              }
            })}
          </ul>
          <div className="mt-1 text-center">
            {!expanded && hiddenCount > 0 && (
              <button
                className="text-sm text-h3-text hover:underline hover:cursor-pointer"
                onClick={() => setExpanded(true)}
              >
                ... Show more (+{hiddenCount})
              </button>
            )}
            {expanded && (
              <button
                className="text-sm text-h3-text hover:underline hover:cursor-pointer"
                onClick={() => setExpanded(false)}
              >
                Show less
              </button>
            )}
          </div>
        </div>

        
        <div className='flex justify-center bg-page-background m-2 mt-0 rounded-lg gap-16'>
          {
            /** Only owners and editors can edit the whiteboard name **/
            (variant.name === 'own_whiteboard') && (
              <Button
                className='bg-transparent'
                onClick={openRenameModal}
                title="Rename whiteboard"
              >
                <FilePen />
              </Button>
            )
          }
          {/* All user permissions can share the whiteboards */}
          <Button
            className='bg-transparent'
            onClick={openShareModal}
            title="Share whiteboard"
          >
            <Share />
          </Button>
          {
            /** Only owners of the whiteboard can delete it **/
            (variant.name === 'own_whiteboard') && (
              <Button
                className='bg-transparent text-destructive'
                onClick={openDeletionModal}
                title="Delete whiteboard"
              >
                <Trash2 />
              </Button>
            )
            || null
          }
        </div>
      </div>

      {/** Modal that opens to rename the whiteboard **/}
      <RenameModal
        zIndex={20}
        className="p-8 rounded-sm"
      >
        <RenameWhiteboardForm
          currentName={name}
          onCancel={closeRenameModal}
          onSubmit={handleSubmitRenameWhiteboard}
        />
      </RenameModal>

      {/** Modal that opens to share the whiteboard **/}
      <ShareModal zIndex={20}>
        <div className="flex flex-col">
          <div className="flex flex-row justify-end">
            <button
              onClick={closeShareModal}
              className="hover:cursor-pointer"
            >
              <X />
            </button>
          </div>

          <ShareWhiteboardForm
            isActive={true}
            initPermissionsByUserId={initPermissionsByUserId}
            initPermissionsByEmail={initPermissionsByEmail}
            onSubmit={handleSubmitShareWhiteboard}
          />
        </div>
      </ShareModal>

      {/** Modal for whiteboard deletion form **/}
      <DeletionModal
        zIndex={20}
        className="p-8 rounded-sm"
      >
        <DeleteWhiteboardForm
          whiteboardId={id}
          onCancel={closeDeletionModal}
          onSubmit={handleSubmitDeleteWhiteboard}
        />
      </DeletionModal>
    </>
  );
}

export default WhiteboardCard;
