// === ImportImageMenu =========================================================
//
// Sidebar panel shown while the import image tool is selected. Lets the user
// pick an image via a file browser or drag and drop, then places the image on
// the selected canvas as a new canvas object.
//
// =============================================================================

import {
  useCallback,
  useContext,
  useRef,
  useState,
} from 'react';

import {
  Bounce,
  toast,
} from 'react-toastify';

// -- local imports
import WhiteboardContext from '@/context/WhiteboardContext';

import {
  ClientMessengerContext,
} from '@/context/ClientMessengerContext';

import {
  store,
} from '@/store';

import {
  selectWhiteboardById,
} from '@/store/whiteboards/whiteboardsSelectors';

import {
  selectCanvasById,
  selectSelectedCanvasByWhiteboard,
} from '@/store/canvases/canvasesSelectors';

import {
  selectMaxZIndexByCanvas,
} from '@/store/canvasObjects/canvasObjectsSelectors';

import {
  updateWhiteboard,
} from '@/controllers';

import {
  type ImageModel,
} from '@/types/CanvasObjectModel';

// -- imported images are scaled down to fit within this fraction of the canvas
const MAX_CANVAS_FRACTION = 0.8;

const ImportImageMenu = () => {
  const whiteboardContext = useContext(WhiteboardContext);

  if (! whiteboardContext) {
    throw new Error('No whiteboard context');
  }

  const clientMessengerContext = useContext(ClientMessengerContext);

  if (! clientMessengerContext) {
    throw new Error('No client messenger context provided');
  }

  const {
    whiteboardId,
  } = whiteboardContext;

  const {
    clientMessenger,
  } = clientMessengerContext;

  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isDragOver, setIsDragOver] = useState(false);

  const importImageFile = useCallback(
    (file: File) => {
      if (! file.type.startsWith('image/')) {
        toast.error('Only image files can be imported', {
          position: "bottom-center",
          hideProgressBar: true,
          closeOnClick: true,
          theme: "colored",
          transition: Bounce,
        });

        return;
      }

      const reader = new FileReader();

      reader.onload = () => {
        const src = reader.result;

        if (typeof src !== 'string') return;

        // -- load the image to determine its natural dimensions
        const img = new window.Image();

        img.onload = () => {
          if (! clientMessenger) return;

          const currState = store.getState();
          const canvasId = selectSelectedCanvasByWhiteboard(currState, whiteboardId)
            ?? selectWhiteboardById(currState, whiteboardId)?.rootCanvas;

          if (! canvasId) return;

          const canvasAttribs = selectCanvasById(currState, canvasId);

          if (! canvasAttribs) return;

          // -- scale down (never up) to fit within the canvas, then center
          const scale = Math.min(
            1,
            (canvasAttribs.width * MAX_CANVAS_FRACTION) / img.naturalWidth,
            (canvasAttribs.height * MAX_CANVAS_FRACTION) / img.naturalHeight
          );
          const width = img.naturalWidth * scale;
          const height = img.naturalHeight * scale;

          const imageModel : ImageModel = {
            type: 'image',
            x: (canvasAttribs.width - width) / 2,
            y: (canvasAttribs.height - height) / 2,
            width,
            height,
            rotation: 0,
            src,
            shadow: 0,
            zIndex: selectMaxZIndexByCanvas(currState, canvasId) + 1,
          };

          clientMessenger.sendCreateCanvasObjects({
            type: 'create_canvas_objects',
            canvasId,
            canvasObjects: [imageModel],
          });

          // -- switch to hand tool after creation, as with drawn shapes
          updateWhiteboard(store.dispatch, whiteboardId, {
            currentTool: 'hand',
          });
        };

        img.onerror = () => {
          toast.error('Could not load the selected image', {
            position: "bottom-center",
            hideProgressBar: true,
            closeOnClick: true,
            theme: "colored",
            transition: Bounce,
          });
        };

        img.src = src;
      };

      reader.readAsDataURL(file);
    },
    [clientMessenger, whiteboardId]
  );// -- end importImageFile

  const handleFileChange = useCallback(
    (ev: React.ChangeEvent<HTMLInputElement>) => {
      const file = ev.target.files?.[0];

      if (file) {
        importImageFile(file);
      }

      // -- reset so selecting the same file again re-triggers onChange
      ev.target.value = '';
    },
    [importImageFile]
  );

  const handleDrop = useCallback(
    (ev: React.DragEvent<HTMLDivElement>) => {
      ev.preventDefault();
      setIsDragOver(false);

      const file = ev.dataTransfer.files?.[0];

      if (file) {
        importImageFile(file);
      }
    },
    [importImageFile]
  );

  const handleDragOver = useCallback(
    (ev: React.DragEvent<HTMLDivElement>) => {
      ev.preventDefault();
      setIsDragOver(true);
    },
    []
  );

  const handleDragLeave = useCallback(
    (ev: React.DragEvent<HTMLDivElement>) => {
      ev.preventDefault();
      setIsDragOver(false);
    },
    []
  );

  return (
    <div className="flex flex-col flex-shrink-0 text-center p-4 rounded-lg shadow-2xl backdrop-blur-md bg-bar-background/80 border-1 border-border">
      <h2 className="text-md text-h1-text font-bold mb-1">Import Image</h2>

      <div
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        className={`flex flex-col items-center gap-2 p-4 rounded-lg border-2 border-dashed ${isDragOver ? 'border-primary bg-header-button-background' : 'border-border'}`}
      >
        <p className="text-sm">
          Drag &amp; drop an image here
        </p>

        <p className="text-sm">or</p>

        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          className="p-2 rounded-xl border-1 border-border hover:cursor-pointer hover:bg-header-button-background-hover hover:text-header-button-text-hover"
        >
          Browse ...
        </button>

        <input
          ref={fileInputRef}
          name="import-image-file"
          type="file"
          accept="image/*"
          onChange={handleFileChange}
          className="hidden"
        />
      </div>
    </div>
  );
};// end ImportImageMenu

export default ImportImageMenu;
