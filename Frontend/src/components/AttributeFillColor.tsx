// -- std imports
import {
  useContext,
  useCallback,
} from 'react';

import {
  useSelector,
} from 'react-redux';

// -- local imports
import {
  type AttributeDefinition,
  type AttributeProps,
} from "@/types/Attribute";

import {
  type CanvasObjectIdType,
  type CanvasObjectModel,
} from "@/types/CanvasObjectModel";

import WhiteboardContext from '@/context/WhiteboardContext';

import {
  type RootState,
} from '@/store';

import {
  selectCanvasObjectsByCanvas,
} from '@/store/canvasObjects/canvasObjectsSelectors';

import AttributeMenuItem from "./AttributeMenuItem";

const FillColorComponent = ({
  selectedShapeIds, 
  dispatch, 
  canvasId, 
  value,
}: AttributeProps) => {
  const whiteboardContext = useContext(WhiteboardContext);

  if (! whiteboardContext) {
    throw new Error('No Whiteboard context provided to AttributeFillColor');
  }

  const {
    handleUpdateShapes,
  } = whiteboardContext;

  const canvasObjectsById = useSelector(
    (state: RootState) => selectCanvasObjectsByCanvas(state, canvasId)
  );

  const onChangeFillColor = useCallback(
    (ev: React.ChangeEvent<HTMLInputElement>) => {
      ev.preventDefault();

      const color = ev.target.value;
    
      dispatch({ type: 'SET_FILL_COLOR', payload: color });
    
      if (canvasObjectsById) {
        handleUpdateShapes(
          canvasId,
          canvasObjectsById,
          Object.fromEntries(selectedShapeIds.map(id => [id, { fillColor: color }])) as Record<CanvasObjectIdType, Partial<CanvasObjectModel>>
        );
      }
    },
    [dispatch, handleUpdateShapes, canvasId, canvasObjectsById, selectedShapeIds]
  );
 
  return (
    <AttributeMenuItem title="Fill Color">
      <input
        name="fill-color"
        type="color"
        value={value}
        onChange={onChangeFillColor}
        className=""
      />
    </AttributeMenuItem> 
  );
}

const AttributeFillColor: AttributeDefinition = {
  name: "Fill Color",
  key: "fillColor",
  Component: FillColorComponent,
}

export default AttributeFillColor;
