import {
  useCallback,
} from 'react';

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

const FontColorComponent = ({
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

  const onChangeFontColor = useCallback(
    (ev: React.ChangeEvent<HTMLInputElement>) => {
      ev.preventDefault();
      const color = ev.target.value;
    
      dispatch({ type: 'SET_FONT_COLOR', payload: color });
    
      if (canvasObjectsById) {
        handleUpdateShapes(
          canvasId,
          canvasObjectsById,
          Object.fromEntries(selectedShapeIds.map(id => [id, { color: color }])) as Record<CanvasObjectIdType, Partial<CanvasObjectModel>>
        );  
      }
    },
    [dispatch, handleUpdateShapes, canvasId, canvasObjectsById, selectedShapeIds]
  );// -- end onChangeFontColor
 
  return (
    <div>
      <AttributeMenuItem title="Font Color">
        <input
          name="font-color"
          type="color"
          value={value}
          onChange={onChangeFontColor}
          className=""
        />
      </AttributeMenuItem>
    </div>
  );
}

const AttributeFontColor: AttributeDefinition = {
  name: "Font Color",
  key: "color",
  Component: FontColorComponent,
}

export default AttributeFontColor;
