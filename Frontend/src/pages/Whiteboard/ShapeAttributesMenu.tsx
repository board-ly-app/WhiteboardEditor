import {
  useContext,
} from 'react';

import {
  useSelector,
} from 'react-redux';

import {
  type Dispatch,
} from 'react';

import lodash from 'lodash';

// -- local imports
import WhiteboardContext from '@/context/WhiteboardContext';

import {
  useUser,
} from '@/hooks/useUser';

import {
  type ClientIdType,
  type CanvasIdType,
} from '@/types/WebSocketProtocol';

import {
  type ShapeAttributesState,
  type ShapeAttributesAction,
} from '@/reducers/shapeAttributesReducer';

import {
  type RootState,
} from '@/store';

import {
  selectClientId,
} from '@/store/client/clientSelectors';

import {
  selectWhiteboardById,
} from '@/store/whiteboards/whiteboardsSelectors';

import {
  getShapeType,
  selectCanvasObjectById,
  selectSelectedCanvasObjectsByWhiteboard,
} from '@/store/canvasObjects/canvasObjectsSelectors';

import {
  selectSelectedCanvasByWhiteboard,
} from '@/store/canvases/canvasesSelectors';

import {
  getAttributesByShape,
  type AttributeDefinition,
} from '@/types/Attribute';

import type {
  CanvasObjectIdType, 
  CanvasObjectModel,
} from '@/types/CanvasObjectModel';

import {
  type ToolChoice,
} from '@/components/Tool';

export interface ShapeAttributesMenuProps {
  attributes: ShapeAttributesState;
  dispatch: Dispatch<ShapeAttributesAction>;
}

// -- consecutive inline attribute definitions share a single menu row
const groupIntoRows = (definitions: AttributeDefinition[]): AttributeDefinition[][] => {
  const rows: AttributeDefinition[][] = [];

  for (const definition of definitions) {
    const lastRow = rows[rows.length - 1];

    if (definition.inline && lastRow && lastRow[lastRow.length - 1].inline) {
      lastRow.push(definition);
    } else {
      rows.push([definition]);
    }
  }

  return rows;
};

const ShapeAttributesMenu = (props: ShapeAttributesMenuProps) => {
  const { attributes, dispatch } = props;

  const whiteboardContext = useContext(WhiteboardContext);

  if (! whiteboardContext) {
    throw new Error('No whiteboard context');
  }

  const {
    user,
  } = useUser();

  if (! user) {
    throw new Error('No authenticated user provided');
  }

  const {
    whiteboardId,
    handleUpdateShapes,
    currentDispatcherRef,
  } = whiteboardContext;

  const currentTool : ToolChoice | null = useSelector(
    (state: RootState) => selectWhiteboardById(state, whiteboardId)?.currentTool ?? null,
    lodash.isEqual
  );

  if (! currentTool) {
    throw new Error('no current tool provided');
  }

  const clientId : ClientIdType | null = useSelector(
    (state: RootState) => selectClientId(state),
    lodash.isEqual
  );

  const selectedCanvasId : CanvasIdType | undefined = useSelector(
    (state: RootState) => selectSelectedCanvasByWhiteboard(state, whiteboardId),
    lodash.isEqual
  );

  const selectedCanvasObjectIds : CanvasObjectIdType[] = useSelector(
    (state: RootState) => selectSelectedCanvasObjectsByWhiteboard(
      state, whiteboardId, clientId
    ),
    lodash.isEqual
  );

  // TODO: Change this for multiple select, right now only handles one shape
  const firstShapeId = selectedCanvasObjectIds[0];

  const shapeType = useSelector((state: RootState) => 
    selectedCanvasId && firstShapeId ? getShapeType(state, firstShapeId) : undefined,
    lodash.isEqual
  );
  const firstShape = useSelector(
    (state: RootState) => firstShapeId && selectedCanvasId
      ? selectCanvasObjectById(state, firstShapeId)
      : undefined,
    lodash.isEqual
  );

  if (! clientId) {
    return null;
  }

  if (! selectedCanvasId) {
    return null;
  }
  
  let attributeComponents: AttributeDefinition[];
  let useSelectedShapeValues = false;

  if (currentTool === "hand" && shapeType) {
    // Shape edit mode
    attributeComponents = getAttributesByShape(shapeType);
    useSelectedShapeValues = true;
  } else {
    // Tool mode
    if (currentTool === "hand") {
      return null;
    }

    attributeComponents = currentDispatcherRef.current?.getAttributes() ?? [];
  }

  if ((! attributeComponents) || (attributeComponents.length < 1)) return null;

  return (
    <div className="toolbar-scale flex flex-col flex-shrink-0 text-center p-4 pr-2 rounded-lg shadow-2xl backdrop-blur-md bg-bar-background/80 border-1 border-border">
      <h2 className="text-md text-h1-text font-bold mb-1">Edit Attributes</h2>
      <form
        className="flex flex-col gap-1"
        onSubmit={(ev: React.FormEvent<HTMLFormElement>) => {
          ev.preventDefault();
        }}
      >
        {groupIntoRows(attributeComponents).map((row) => {
          const attributeElements = row.map(({ Component, key }) => (
            <Component
              key={key}
              selectedShapeIds={selectedCanvasObjectIds}
              dispatch={dispatch}
              handleUpdateShapes={handleUpdateShapes}
              canvasId={selectedCanvasId}
              value={useSelectedShapeValues && firstShape
                ? firstShape[key as keyof CanvasObjectModel]
                : attributes[key]
              }
              className="rounded-lg border-border"
            />
          ));

          if (row.length === 1) {
            return attributeElements[0];
          }

          return (
            <div
              key={row.map(({ key }) => key).join('-')}
              className="flex justify-center gap-2"
            >
              {attributeElements}
            </div>
          );
        })}
      </form>
    </div>
  );
};// end ShapeAttributesMenu

export default ShapeAttributesMenu;
