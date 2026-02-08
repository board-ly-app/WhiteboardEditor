// === DeleteShapesButton =======================================================
//
// Button for sending a delete shape message to the server.
//
// Intended to be displayed on the left-hand Sidebar.
//
// =============================================================================

// -- std imports
import {
  useContext,
  useCallback,
} from 'react';

import {
  useSelector,
} from 'react-redux';

// --- local imports
import {
  type RootState,
} from '@/store';

import {
  selectSelectedCanvasObjects,
} from '@/store/canvasObjects/canvasObjectsSelectors';

import {
  ClientMessengerContext,
} from '@/context/ClientMessengerContext';

import WhiteboardContext from '@/context/WhiteboardContext';

import {
  type ClientMessageDeleteCanvasObjects,
} from '@/types/WebSocketProtocol';

import type { 
  CanvasObjectIdType, 
} from "@/types/CanvasObjectModel";

import {
  Button,
} from '@/components/ui/button';

const DeleteShapesButton = () => {
  const whiteboardContext = useContext(WhiteboardContext);

  if (! whiteboardContext) {
    throw new Error('No WhiteboardContext provided to DeleteShapesButton');
  }

  const clientMessengerContext = useContext(ClientMessengerContext);

  if (! clientMessengerContext) {
    throw new Error('No ClientMessengerContext provided to DeleteShapesButton');
  }

  const {
    clientMessenger,
  } = clientMessengerContext;

  const selectedCanvasObjectIds : CanvasObjectIdType[] = Object.keys(useSelector(
    (state: RootState) => selectSelectedCanvasObjects(state)
  ));

  const handleSubmit = useCallback(
    () => {
      if (clientMessenger) {
        const deleteCanvasObjectsMsg : ClientMessageDeleteCanvasObjects = {
          type: 'delete_canvas_objects',
          canvasObjectIds: selectedCanvasObjectIds,
        };

        clientMessenger.sendDeleteCanvasObjects(deleteCanvasObjectsMsg);
      }
    },
    [clientMessenger, selectedCanvasObjectIds]
  );

  if ((! selectedCanvasObjectIds) || (selectedCanvasObjectIds.length === 0)) {
    // Should not display button
    return null;
  } else {
    return (
        <Button
          size="lg"
          onClick={handleSubmit}
          variant="destructive"
          className="bg-header-button-background border-1 border-border hover:text-header-button-text-hover"
        >
          Delete Shape(s)
        </Button>
    );
  }
};// -- end 

export default DeleteShapesButton;
