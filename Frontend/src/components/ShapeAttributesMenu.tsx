import {
  useContext,
} from 'react';

import {
  useSelector,
} from 'react-redux';

import {
  type Dispatch,
} from 'react';

// -- local imports
import WhiteboardContext from '@/context/WhiteboardContext';

import type {
  ShapeAttributesState,
  ShapeAttributesAction,
} from '@/reducers/shapeAttributesReducer';

import {
  getShapeType,
  selectCanvasObjectById,
  selectSelectedCanvasObjects,
} from '@/store/canvasObjects/canvasObjectsSelectors';

import type {
  RootState,
} from '@/store';

import {
  getAttributesByShape,
  type AttributeDefinition,
} from '@/types/Attribute';

import type {
  CanvasObjectIdType, 
  CanvasObjectModel,
} from '@/types/CanvasObjectModel';

export interface ShapeAttributesMenuProps {
  attributes: ShapeAttributesState;
  dispatch: Dispatch<ShapeAttributesAction>;
}

const ShapeAttributesMenu = (props: ShapeAttributesMenuProps) => {
  const { attributes, dispatch } = props;

  const whiteboardContext = useContext(WhiteboardContext);

  if (! whiteboardContext) {
    throw new Error('No whiteboard context');
  }

  const {
    handleUpdateShapes,
    currentTool,
    currentDispatcher,
    selectedCanvasId,
  } = whiteboardContext;

  const selectedCanvasObjectIds : CanvasObjectIdType[] = Object.keys(useSelector(
    (state: RootState) => selectSelectedCanvasObjects(state)
  ));

  // TODO: Change this for multiple select, right now only handles one shape
  const firstShapeId = selectedCanvasObjectIds[0];

  const shapeType = useSelector((state: RootState) => 
    selectedCanvasId && firstShapeId ? getShapeType(state, firstShapeId) : undefined
  );
  const firstShape = useSelector((state: RootState) =>
    firstShapeId && selectedCanvasId
      ? selectCanvasObjectById(state, firstShapeId)
      : undefined
  );

  if (currentTool === 'create_canvas') return null;

  if (! selectedCanvasId) {
    return null;
  }
  
  let AttributeComponents: AttributeDefinition[];

  if (currentTool === "hand" && shapeType) {
    // Shape edit mode
    AttributeComponents = getAttributesByShape(shapeType);
  }
  else {
    // Tool mode
    console.log("tool mode", currentDispatcher, currentTool);

    if (!currentDispatcher || currentTool == "hand") {
      return null;
    }
    AttributeComponents = currentDispatcher.getAttributes();
  }

  return (
    <div className="flex flex-col flex-shrink-0 text-center p-4 pr-2 rounded-lg shadow-2xl backdrop-blur-md bg-bar-background/80 border-1 border-border">
      <h2 className="text-md text-h1-text font-bold mb-1">Edit Attributes</h2>
      <form
        className="flex flex-col gap-1"
        onSubmit={(ev: React.FormEvent<HTMLFormElement>) => {
          ev.preventDefault();
        }}
      >
        {AttributeComponents.map(({ Component, key }) => (
          <Component
            key={key}
            selectedShapeIds={selectedCanvasObjectIds}
            dispatch={dispatch}
            handleUpdateShapes={handleUpdateShapes}
            canvasId={selectedCanvasId}
            value={firstShape ? firstShape[key as keyof CanvasObjectModel] : attributes[key]}
            className="rounded-lg border-border"
          />
        ))}
      </form>
    </div>
  );
};// end ShapeAttributesMenu

export default ShapeAttributesMenu;
