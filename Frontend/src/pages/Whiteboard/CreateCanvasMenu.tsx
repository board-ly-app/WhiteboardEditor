import {
  useState,
  useMemo,
  useCallback,
  useContext,
} from 'react';

import {
  useSelector,
} from 'react-redux';

import {
  toast,
} from 'react-toastify';

import {
  type ClientMessageCreateCanvas,
} from '@/types/WebSocketProtocol';

import {
  type RootState,
  store,
} from '@/store';

import {
  setCreateCanvasInactive,
  setCreateCanvasRequesting,
} from '@/store/userFlows/createCanvas/createCanvasSlice';

import {
  selectCreateCanvasFlowState,
} from '@/store/userFlows/createCanvas/createCanvasSelectors';

import {
  ClientMessengerContext,
} from '@/context/ClientMessengerContext';

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { AppModal } from "@/components/ui/app-modal";
import AllowedUsersPopover from '@/components/AllowedUsersPopover';

const CreateCanvasMenu = () => {
  const FORM_ID = "create-canvas";

  const componentState = useSelector(
    (state: RootState) => selectCreateCanvasFlowState(state)
  );

  const clientMessengerContext = useContext(ClientMessengerContext);
  if (! clientMessengerContext) throw new Error('No ClientMessengerContext provided');
  const {
    clientMessenger,
  } = clientMessengerContext;

  const [canvasName, setCanvasName] = useState("");
  const [newCanvasAllowedUsers, setNewCanvasAllowedUsers] = useState<string[]>([]);

  // -- Modal cannot be opened without additional information to initialize
  const closeModal = useCallback(
    () => {
      store.dispatch(setCreateCanvasInactive({}));
    },
    []
  );// -- end handleSetClosed

  const handleCreateCanvas = useCallback(
    () => {
      if (! clientMessenger) {
        console.error('No client messenger available');
        toast.error('Could not reach server');
        return;
      }

      const currState = store.getState();
      const currComponentState = selectCreateCanvasFlowState(currState);

      switch (currComponentState.status) {
        case 'inactive':
        case 'ready':
          console.error(`Not ready to create canvas; current component state "${currComponentState.status}"`);
          toast.error('Not ready to create canvas');
          return;
        case 'requesting':
        {
          const {
            parentCanvasId,
            width,
            height,
            name,
            originX,
            originY,
            allowedUsers,
          } = currComponentState;

          const createCanvasMsg : ClientMessageCreateCanvas = ({
            type: 'create_canvas',
            width,
            height,
            name,
            parentCanvas: {
              canvasId: parentCanvasId,
              originX,
              originY,
            },
            allowedUsers,
          });
      
          clientMessenger.sendCreateCanvas(createCanvasMsg);
        }
        break;
        default:
          throw new Error('Unrecognized component state');
      }// -- end switch (currComponentState.status)
    },
    [clientMessenger]
  );// -- end handleCreateCanvas

  const handleSubmit = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault();

      // -- Validate user inputs
      if (! canvasName.trim()) {
        console.error('New canvas name cannot be empty');
        toast.error("Canvas name cannot be empty");
        return;
      }

      const currState = store.getState();
      const currComponentState = selectCreateCanvasFlowState(currState);

      switch (currComponentState.status) {
        case 'inactive':
          console.error('Not ready to submit create canvas request');
          toast.error('Not ready to submit create canvas request');
          return;
        case 'requesting':
          console.error('Already requesting to create a new canvas');
          toast.error('Already requesting to create a new canvas');
          return;
        case 'ready':
        {
          // -- Prepare to send request to web socket server
          store.dispatch(setCreateCanvasRequesting({
            ...currComponentState,
            name: canvasName.trim(),
            allowedUsers: newCanvasAllowedUsers,
          }));

          // -- Send request
          handleCreateCanvas();

          // -- Set component state to inactive
          setCanvasName("");
          setNewCanvasAllowedUsers([]);
          closeModal();
        }
        break;
        default:
          throw new Error('Unrecognized component state');
      }// -- end switch (currComponentState.status)
    },
    [closeModal, handleCreateCanvas, canvasName, newCanvasAllowedUsers]
  );// -- end handleSubmit

  const isCreateDisabled : boolean = useMemo(
    () => {
      return (
        (componentState.status === 'requesting')
        || (canvasName.trim().length <= 0)
      );
    },
    [canvasName, componentState.status]
  );

  switch (componentState.status) {
    case 'inactive':
      return null;
    case 'ready':
    case 'requesting':
      return (
        <AppModal
          open={true}
          onOpenChange={closeModal}
          title="Create New Canvas"
          footer={
            <>
              <Button
                variant="secondary"
                onClick={closeModal}
                disabled={componentState.status === 'requesting'}
              >
                Cancel
              </Button>
              <Button 
                type="submit"
                form={FORM_ID}
                className='border bg-card-background'
                disabled={isCreateDisabled}
                status={componentState.status === 'requesting' ? 'pending' : 'enabled'}
              >
                Create
              </Button>
            </>
          }
        >
          <form 
            id={FORM_ID}
            className="grid gap-4"
            onSubmit={handleSubmit}
          >
            <div className='flex flex-col gap-2'>
              <Label htmlFor="name">Canvas Name</Label>
              <Input
                id="name"
                value={canvasName}
                onChange={(e) => setCanvasName(e.target.value)}
                placeholder="Enter name"
                disabled={componentState.status !== 'ready'}
                required
              />
            </div>

            <div className='flex flex-col gap-2'>
              <Label htmlFor="users">Allowed Users</Label>
              <AllowedUsersPopover
                selected={newCanvasAllowedUsers}
                onChange={setNewCanvasAllowedUsers}
              />
            </div>
          </form>
        </AppModal>
      );
  }// -- end switch (componentState.status)
};// -- end CreateCanvasMenu

export default CreateCanvasMenu;
