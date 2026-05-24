import {
  useSelector,
} from 'react-redux';

import lodash from 'lodash';

import {
  type RootState,
} from '@/store';

import {
  selectCanvasObjectsByCanvas,
} from '@/store/canvasObjects/canvasObjectsSelectors';

import type { AttributeDefinition, AttributeProps } from "@/types/Attribute";
import type { CanvasObjectIdType, CanvasObjectModel } from "@/types/CanvasObjectModel";
import AttributeMenuItem from "./AttributeMenuItem";

const StrokeColorComponent = ({
  selectedShapeIds, 
  handleUpdateShapes, 
  dispatch, 
  canvasId, 
  value,
}: AttributeProps) => {
  const canvasObjectsById = useSelector(
    (state: RootState) => selectCanvasObjectsByCanvas(state, canvasId),
    lodash.isEqual
  );

  const onChangeStrokeColor = (ev: React.ChangeEvent<HTMLInputElement>) => {
    ev.preventDefault();
    const color = ev.target.value;
  
    dispatch({ type: 'SET_STROKE_COLOR', payload: color });
  
    if (canvasObjectsById) {
      handleUpdateShapes(
        canvasId,
        canvasObjectsById,
        Object.fromEntries(selectedShapeIds.map(id => [id, { strokeColor: color }])) as Record<CanvasObjectIdType, Partial<CanvasObjectModel>>
      );
    }
  };
 
  return (
    <div>
      <AttributeMenuItem title="Stroke Color">
        <input
          name="stroke-color"
          type="color"
          value={value}
          onChange={onChangeStrokeColor}
          className=""
        />
      </AttributeMenuItem>
    </div>
  );
}

const AttributeStrokeColor: AttributeDefinition = {
  name: "Stroke Color",
  key: "strokeColor",
  Component: StrokeColorComponent,
}

export default AttributeStrokeColor;
