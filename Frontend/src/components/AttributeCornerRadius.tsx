import {
  useCallback,
  useEffect,
  useState,
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

const CornerRadiusComponent = ({
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
  const [inputValue, setInputValue] = useState(value?.toString() ?? '0');

  useEffect(() => {
    setInputValue(value?.toString() ?? '0');
  }, [value]);

  const onChangeCornerRadius = useCallback(
    (ev: React.ChangeEvent<HTMLInputElement>) => {
      ev.preventDefault();

      const val = ev.target.value;
      setInputValue(val);

      const cornerRadiusParsed = parseFloat(val);

      if (!isNaN(cornerRadiusParsed) && cornerRadiusParsed >= 0) {
        dispatch({ type: 'SET_CORNER_RADIUS', payload: cornerRadiusParsed });

        if (canvasObjectsById) {
          handleUpdateShapes(
            canvasId,
            canvasObjectsById,
            Object.fromEntries(selectedShapeIds.map(id => [id, { cornerRadius: cornerRadiusParsed }])) as Record<CanvasObjectIdType, Partial<CanvasObjectModel>>
          );
        }
      }
    },
    [setInputValue, dispatch, handleUpdateShapes, canvasId, canvasObjectsById, selectedShapeIds]
  );

  return (
    <div>
      <AttributeMenuItem title="Corner Radius">
        <input
          name="corner-radius"
          type="number"
          min={0}
          step={1}
          value={inputValue}
          onChange={onChangeCornerRadius}
          className="w-16 mr-0"
        />
      </AttributeMenuItem>
    </div>
  );
}

const AttributeCornerRadius: AttributeDefinition = {
  name: "Corner Radius",
  key: "cornerRadius",
  Component: CornerRadiusComponent,
}

export default AttributeCornerRadius;
