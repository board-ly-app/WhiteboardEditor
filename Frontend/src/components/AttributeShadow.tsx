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

  const commitShadow = useCallback(
    (shadow: number) => {
      dispatch({ type: 'SET_SHADOW', payload: shadow });

      if (canvasObjectsById) {
        handleUpdateShapes(
          canvasId,
          canvasObjectsById,
          Object.fromEntries(selectedShapeIds.map(id => [id, { shadow }])) as Record<CanvasObjectIdType, Partial<CanvasObjectModel>>
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
    fallback: '0',
    min: 0,
    commit: commitShadow,
  });

  return (
    <div>
      <AttributeMenuItem title="Shadow">
        <input
          name="shadow"
          type="number"
          min={0}
          step={1}
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

const AttributeShadow: AttributeDefinition = {
  name: "Shadow",
  key: "shadow",
  Component: ShadowComponent,
}

export default AttributeShadow;
