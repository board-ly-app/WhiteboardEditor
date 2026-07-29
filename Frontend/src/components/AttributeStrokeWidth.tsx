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

import {
  useNumericAttributeInput,
} from '@/hooks/useNumericAttributeInput';

import type { AttributeDefinition, AttributeProps } from "@/types/Attribute";
import type { CanvasObjectIdType, CanvasObjectModel } from "@/types/CanvasObjectModel";
import AttributeMenuItem from "./AttributeMenuItem";

const StrokeWidthComponent = ({
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

  const commitStrokeWidth = useCallback(
    (strokeWidth: number) => {
      dispatch({ type: 'SET_STROKE_WIDTH', payload: strokeWidth });

      if (canvasObjectsById) {
        handleUpdateShapes(
          canvasId,
          canvasObjectsById,
          Object.fromEntries(selectedShapeIds.map(id => [id, { strokeWidth }])) as Record<CanvasObjectIdType, Partial<CanvasObjectModel>>
        );
      }
    },
    [dispatch, handleUpdateShapes, canvasId, canvasObjectsById, selectedShapeIds]
  );

  const {
    inputValue,
    onChange,
    onFocus,
    onBlur,
  } = useNumericAttributeInput({
    value,
    commit: commitStrokeWidth,
  });

  return (
    <div>
      <AttributeMenuItem title="Stroke Width">
        <input
          name="stroke-width"
          type="number"
          min={1}
          step={0.5}
          value={inputValue}
          onChange={onChange}
          onFocus={onFocus}
          onBlur={onBlur}
          className="w-16 mr-0"
        />
      </AttributeMenuItem>
    </div>
  );
}

const AttributeStrokeWidth: AttributeDefinition = {
  name: "Stroke Width",
  key: "strokeWidth",
  Component: StrokeWidthComponent,
}

export default AttributeStrokeWidth;
