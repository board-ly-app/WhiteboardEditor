// -- std imports
import {
  useContext,
  useCallback,
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

// -- local imports
import api from '@/api/axios';

import type {
  Whiteboard,
  UserPermissionEnum,
} from '@/types/APIProtocol';

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
  Button,
} from '@/components/ui/button';

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

  const {
    Modal: DeletionModal,
    openModal: openDeletionModal,
    closeModal: closeDeletionModal,
  } = useModal();

  // -- miscellaneous callback functions
  const handleSubmitDeleteWhiteboard = useCallback(() => {
      api.delete(`/whiteboards/${id}`).
        then(() => {
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
        })
        .catch((e: AxiosError) => {
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
        })
        .finally(() => {
          closeDeletionModal();
        });
    },
    [closeDeletionModal, id, queryClient, user.id]
  );// -- end handleSubmitDeleteWhiteboard

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
        className="flex flex-col justify-center align-items-center m-2 md:m-4 w-75 rounded-xl border-1 border-border shadow-2xl bg-card-background"
      >
        <Link 
          key={id}
          to={`/whiteboard/${id}`}
          className="hover:bg-button-hover"
        >
          <img
            className={`rounded-t-xl w-full h-50 bg-canvas-background ${
              thumbnail_url ? 'object-contain' : 'object-cover'
            }`}
            src={thumbnail_url || "/images/testThumbnail.png"} 
            alt="Whiteboard Thumbnail" 
          />
          <div className="p-5">
            <h1 className="text-lg text-h2-text font-bold">{name}</h1>

            {/** List shared users **/}
            <h3 className="text-h3-text">Collaborators: </h3>
            <ul
              className="flex flex-row flex-wrap"
            >
              {userPermissions?.map(perm => {
                if (perm.type === 'user') {
                  if ((typeof perm.user) !== 'object') {
                    throw new Error(`User must be object; received ${perm.user}`);
                  }

                  return (
                    <li key={`user:${perm.user.id}`}>
                      <UserTagBrief
                        size="small"
                        user={perm.user}
                        note={
                          <span> ({permissionTypeToUserRole(perm.permission)})</span>
                        }
                      />
                    </li>
                  );
                } else {
                  return (
                    <li key={`email:${perm.email}`}>
                      <UserTagEmail
                        size="small"
                        email={perm.email}
                        note={
                          <span> ({permissionTypeToUserRole(perm.permission)})</span>
                        }
                      />
                    </li>
                  );
                }
              })}
            </ul>
          </div>
        </Link>

        {
          /** If this is whiteboard is owned by the user, give them the option
           * to delete it. **/
          (variant.name === 'own_whiteboard')
            && (
              <Button
                variant="destructive"
                onClick={openDeletionModal}
              >
                Delete
              </Button>
            )
            || null
        }
      </div>

      {/** Modal for whiteboard deletion form **/}
      <DeletionModal
        zIndex={20}
        className="p-8 rounded-sm"
      >
        <DeleteWhiteboardForm
          onCancel={closeDeletionModal}
          onSubmit={handleSubmitDeleteWhiteboard}
          whiteboardAttribs={{ id, name }}
        />
      </DeletionModal>
    </>
  );
}

export default WhiteboardCard;
