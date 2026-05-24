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
import { useEffect, useState } from "react";

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

  const [inputValue, setInputValue] = useState(value.toString());

  useEffect(() => {
    setInputValue(value.toString());
  }, [value]);
  
  const onChangeFontSize = useCallback(
    (ev: React.ChangeEvent<HTMLInputElement>) => {
      ev.preventDefault();

      const val = ev.target.value;
      setInputValue(val);

      const size = parseFloat(val);
      
      if (!isNaN(size)) {
        dispatch({ type: 'SET_FONT_SIZE', payload: size });

        if (canvasObjectsById) {
          handleUpdateShapes(
            canvasId,
            canvasObjectsById,
            Object.fromEntries(selectedShapeIds.map(id => [id, { fontSize: size }])) as Record<CanvasObjectIdType, Partial<CanvasObjectModel>>
          );
        }
      }
    },
    [dispatch, handleUpdateShapes, canvasObjectsById, canvasId, selectedShapeIds]
  );
 
  return (
    <div>
      <AttributeMenuItem title="Font Size">
        <input
          name="font-size"
          type="number"
          value={inputValue}
          onChange={onChangeFontSize}
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
