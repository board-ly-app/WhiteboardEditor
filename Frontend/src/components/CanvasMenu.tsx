// -- std imports
import { 
  useState,
  useContext,
  useCallback,
} from "react";

import lodash from 'lodash';

// -- third-party imports
import {
  useSelector,
} from "react-redux";

// -- local imports
import { 
  DropdownMenu, 
  DropdownMenuTrigger, 
  DropdownMenuContent, 
  DropdownMenuItem,
  DropdownMenuSub,
  DropdownMenuSubTrigger,
  DropdownMenuSubContent,
  DropdownMenuLabel,
  DropdownMenuSeparator, 
} from "@/components/ui/dropdown-menu";

import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
} from "@/components/ui/dialog";

import { Button } from "./ui/button";

import { 
  type RootState,
} from "@/store";

import {
  selectCanvasById,
  selectUserHasAccessToCanvas,
} from '@/store/canvases/canvasesSelectors';

import {
  selectWhiteboardPermissionByUser,
} from '@/store/whiteboards/whiteboardsSelectors';

import WhiteboardContext from "@/context/WhiteboardContext";

import {
  ClientMessengerContext,
} from '@/context/ClientMessengerContext';

import {
  useUser,
} from '@/hooks/useUser';

import AllowedUsersPopover from "@/components/AllowedUsersPopover";

import { 
  type UserIdType,
  type CanvasIdType, 
  type WhiteboardIdType,
  type WhiteboardAttribs,
  type CanvasAttribs,
} from "@/types/WebSocketProtocol";

import {
  selectAllowedUsersByCanvas
} from "@/store/allowedUsers/allowedUsersByCanvasSlice";

import {
  selectWhiteboardById,
} from '@/store/whiteboards/whiteboardsSelectors';

import {
  ChevronUp,
  SquarePen,
} from 'lucide-react';
import HeaderButton from "./HeaderButton";
import { captureImage, type ImageTypeEnum } from "@/lib/captureImage";

interface CanvasMenuProps {
  name: string;
  canvasId: CanvasIdType;
  whiteboardId: WhiteboardIdType;
  allowedUsernames: string[];
}

const CanvasMenu = ({
  name,
  canvasId,
  whiteboardId,
  allowedUsernames,
}: CanvasMenuProps) => {
  const [allowedUsersMenuOpen, setAllowedUsersMenuOpen] = useState(false);
  const allowedUserIdSet : Record<UserIdType, unknown> = useSelector((state: RootState) =>
    selectAllowedUsersByCanvas(state, canvasId) ?? [],
    lodash.isEqual
  );
  const [selectedAllowedUsers, setSelectedAllowedUsers] = useState<string[]>(
    Object.keys(allowedUserIdSet)
  );

  // -- unpack Whiteboard context
  const whiteboardContext = useContext(WhiteboardContext);

  if (! whiteboardContext) {
    throw new Error("CanvasMenu must be used inside a WhiteboardProvider");
  }

  const {
    user,
  } = useUser();

  if (! user) {
    throw new Error('No authenticated user provided');
  }

  const { 
    canvasGroupRefsByIdRef,
  } = whiteboardContext;

  const ownPermission = useSelector(
    (state: RootState) => selectWhiteboardPermissionByUser(state, whiteboardId, user.id),
    lodash.isEqual
  );

  // -- unpack ClientMessenger context
  const clientMessengerContext = useContext(ClientMessengerContext);

  if (! clientMessengerContext) {
    throw new Error('No ClientMessengerContext provided to CanvasMenu');
  }

  const {
    clientMessenger,
  } = clientMessengerContext;

  const userHasAccess = useSelector(
    (state: RootState) => selectUserHasAccessToCanvas(state, canvasId, user.id),
    lodash.isEqual
  );

  const whiteboard: WhiteboardAttribs | null = useSelector((state: RootState) => (
    selectWhiteboardById(state, whiteboardId)),
    lodash.isEqual
  );

  if (! whiteboard) {
    throw new Error(`No whiteboard found with ID whiteboardId`);
  }

  const canvas : CanvasAttribs | null = useSelector(
    (state: RootState) => selectCanvasById(state, canvasId),
    lodash.isEqual
  );

  if (! canvas) {
    throw new Error(`Could not find canvas ${canvasId} in application state`);
  }

  const handleUpdateAllowedUsers = useCallback(
    (allowedUsers: string[]) => {
      if (! clientMessenger) {
        console.error('Could not update allowed users: no ClientMessenger provided');
      } else {
        clientMessenger.sendUpdateCanvasAllowedUsers({
          type: 'update_canvas_allowed_users',
          canvasId,
          allowedUsers,
        });
      }
    },
    [canvasId, clientMessenger]
  );// -- end handleUpdateAllowedUsers

  const handleMerge = useCallback(
    () => {
      if (! clientMessenger) {
        console.error('Could not merge canvas: no ClientMessenger provided');
      } else if (! canvas.parentCanvas) {
        console.error(`Could not merge canvas ${canvasId}: canvas has no parent`);
      } else {
        clientMessenger.sendMergeCanvas({
          type: 'merge_canvas',
          canvasId,
        });
      }
    },
    [clientMessenger, canvasId, canvas.parentCanvas]
  );// -- end handleMerge

  const handleDelete = useCallback(
    () => {
      if (! clientMessenger) {
        console.error('Could not update allowed users: no ClientMessenger provided');
      } else if (! canvas.parentCanvas) {
        console.error(`Could not delete canvas ${canvasId}: canvas has no parent`);
      } else {
        clientMessenger.sendDeleteCanvases({
          type: "delete_canvases",
          canvasIds: [canvasId],
        });
      }
    },
    [canvasId, clientMessenger, canvas.parentCanvas]
  );// -- end handleDelete

  const handleDownload = useCallback(
    () => {
      const imageType: ImageTypeEnum = 'png';
      const imageQuality: number = 1.0;

      const exportUrl = captureImage(canvasGroupRefsByIdRef, canvasId, imageType, imageQuality);

      // -- create a dummy link that the function can "click"
      const downloadLink : HTMLAnchorElement = document.createElement('a');
      const fileName = `${whiteboard.name} - ${canvas.name}.png`;

      downloadLink.download = fileName;
      downloadLink.href = exportUrl;

      document.body.appendChild(downloadLink);
      downloadLink.click();
      document.body.removeChild(downloadLink);
    },
    [canvas.name, canvasGroupRefsByIdRef, canvasId, whiteboard.name]
  );// -- end handleDownload

  // === handleRequestEditPermission ===============================================
  //
  // Requests edit access to this canvas. All users who currently have edit
  // access will be notified, and any one of them will be able to fulfill the
  // request.
  //
  // ===========================================================================
  const handleRequestEditPermission = useCallback(
    () => {
      console.log('!! TODO');
    },
    []
  );// -- end handleRequestEditPermission

  return (
    <div>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <div className="px-4 py-2 rounded-lg shadow-2xl backdrop-blur-md bg-bar-background/80 border-1 border-border">
            <HeaderButton
              title={
                <div className="flex items-center gap-2">
                  <span>
                    Selected Canvas: <strong className="text-lg">{name}</strong>
                  </span>
                  <ChevronUp size={18}/>
                </div>
              }
            />
          </div>
        </DropdownMenuTrigger>

        <DropdownMenuContent className="w-48">
        
          <DropdownMenuSub>
            <DropdownMenuSubTrigger
              className="hover:cursor-pointer"
            >
              Allowed Users
            </DropdownMenuSubTrigger>
            <DropdownMenuSubContent>
              {
                ((ownPermission === 'own') && (
                  <>
                    <DropdownMenuItem 
                      className="flex justify-center" 
                      onSelect={() => setAllowedUsersMenuOpen(true)}
                    >
                      Edit
                      <SquarePen/>
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                  </>
                ))
              }
              {allowedUsernames.map((u) => (
                <DropdownMenuLabel key={u}>
                  {u}
                </DropdownMenuLabel>
              ))}
            </DropdownMenuSubContent>
          </DropdownMenuSub>

          {
            (ownPermission !== 'own') && (! userHasAccess) && (
              <DropdownMenuItem 
                onSelect={handleRequestEditPermission}
              >
                Request Edit Access
                <SquarePen/>
              </DropdownMenuItem>
            )
          }

          <DropdownMenuItem onSelect={handleDownload}>
            Export to PNG
          </DropdownMenuItem>

          {
            // Only display these options if the canvas has a parent
            (canvas.parentCanvas) && 
            (
              <>
                <DropdownMenuItem onSelect={handleMerge}>
                  Merge Canvas into Parent
                </DropdownMenuItem>

                <DropdownMenuItem onSelect={handleDelete}>
                  Delete Canvas
                </DropdownMenuItem>
              </>
            )
            || null
          }
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Edit Users Modal */}
      <Dialog open={allowedUsersMenuOpen} onOpenChange={setAllowedUsersMenuOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Edit Allowed Users</DialogTitle>
          </DialogHeader>

          <AllowedUsersPopover 
            selected={selectedAllowedUsers}
            onChange={setSelectedAllowedUsers}
          />

          <div className="flex justify-end gap-2 pt-4">
            <Button variant="secondary" onClick={() => {
              setSelectedAllowedUsers(Object.keys(allowedUserIdSet)); // Reset to original selection
              setAllowedUsersMenuOpen(false);
            }}>
              Cancel
            </Button>
            <Button onClick={() => {
              handleUpdateAllowedUsers(selectedAllowedUsers);
              setAllowedUsersMenuOpen(false);
            }}>
              Save
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};// -- end CanvasMenu

export default CanvasMenu;
