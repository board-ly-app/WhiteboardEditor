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

  const onChangeShadow = (ev: React.ChangeEvent<HTMLInputElement>) => {
    const shadow = ev.target.checked;

    dispatch({ type: 'SET_SHADOW', payload: shadow });

    if (canvasObjectsById) {
      handleUpdateShapes(
        canvasId,
        canvasObjectsById,
        Object.fromEntries(selectedShapeIds.map(id => [id, { shadow }])) as Record<CanvasObjectIdType, Partial<CanvasObjectModel>>
      );
    }
  };

  return (
    <div>
      <AttributeMenuItem title="Shadow">
        <input
          name="shadow"
          type="checkbox"
          checked={value === true}
          onChange={onChangeShadow}
          className="accent-primary"
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
