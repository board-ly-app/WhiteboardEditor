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
import { THROTTLE_INTERVAL, useThrottledCallback } from '@/hooks/useThrottledCallback';

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

  const throttledUpdate = useThrottledCallback(
    (color: string) => {
      dispatch({ type: 'SET_FONT_COLOR', payload: color});

      if (canvasObjectsById) {
        handleUpdateShapes(
          canvasId,
          canvasObjectsById,
          Object.fromEntries(selectedShapeIds.map(id => [id, { color: color }])) as Record<CanvasObjectIdType, Partial<CanvasObjectModel>>
        );
      }
    },
    THROTTLE_INTERVAL
  );

  const onChangeFontColor = (ev: React.ChangeEvent<HTMLInputElement>) => {
    throttledUpdate(ev.target.value);
  }
  
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
