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

const ShadowComponent = ({
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

  const onChangeShadow = useCallback(
    (ev: React.ChangeEvent<HTMLInputElement>) => {
      ev.preventDefault();

      const val = ev.target.value;
      setInputValue(val);

      const shadowParsed = parseFloat(val);

      if (!isNaN(shadowParsed) && shadowParsed >= 0) {
        dispatch({ type: 'SET_SHADOW', payload: shadowParsed });

        if (canvasObjectsById) {
          handleUpdateShapes(
            canvasId,
            canvasObjectsById,
            Object.fromEntries(selectedShapeIds.map(id => [id, { shadow: shadowParsed }])) as Record<CanvasObjectIdType, Partial<CanvasObjectModel>>
          );
        }
      }
    },
    [setInputValue, dispatch, handleUpdateShapes, canvasId, canvasObjectsById, selectedShapeIds]
  );

  return (
    <div>
      <AttributeMenuItem title="Shadow">
        <input
          name="shadow"
          type="number"
          min={0}
          step={1}
          value={inputValue}
          onChange={onChangeShadow}
          className="w-16 mr-0"
        />
      </AttributeMenuItem>
    </div>
  );
}

const AttributeShadow: AttributeDefinition = {
  name: "Shadow",
  key: "shadow",
  Component: ShadowComponent,
}

export default AttributeShadow;
