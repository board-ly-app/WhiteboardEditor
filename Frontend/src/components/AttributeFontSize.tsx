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

const FontSizeComponent = ({
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

  const commitFontSize = useCallback(
    (fontSize: number) => {
      dispatch({ type: 'SET_FONT_SIZE', payload: fontSize });

      if (canvasObjectsById) {
        handleUpdateShapes(
          canvasId,
          canvasObjectsById,
          Object.fromEntries(selectedShapeIds.map(id => [id, { fontSize }])) as Record<CanvasObjectIdType, Partial<CanvasObjectModel>>
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
    commit: commitFontSize,
  });

  return (
    <div>
      <AttributeMenuItem title="Font Size">
        <input
          name="font-size"
          type="number"
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

const AttributeFontSize: AttributeDefinition = {
  name: "Font Size",
  key: "fontSize",
  Component: FontSizeComponent,
}

export default AttributeFontSize;
