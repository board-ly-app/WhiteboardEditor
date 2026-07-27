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
import type { ArrowTip, CanvasObjectIdType, CanvasObjectModel } from "@/types/CanvasObjectModel";
import type { ShapeAttributesAction } from "@/reducers/shapeAttributesReducer";
import AttributeMenuItem from "./AttributeMenuItem";

const ARROW_TIP_OPTIONS: { value: ArrowTip; label: string }[] = [
  { value: 'none', label: 'None' },
  { value: 'arrow', label: 'Arrow' },
];

const makeArrowTipComponent = (
  title: string,
  field: 'arrowStart' | 'arrowEnd',
  actionType: Extract<ShapeAttributesAction, { payload: ArrowTip }>['type'],
) => {
  const ArrowTipComponent = ({
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

    const onChangeArrowTip = (ev: React.ChangeEvent<HTMLSelectElement>) => {
      const tip = ev.target.value as ArrowTip;

      dispatch({ type: actionType, payload: tip });

      if (canvasObjectsById) {
        handleUpdateShapes(
          canvasId,
          canvasObjectsById,
          Object.fromEntries(selectedShapeIds.map(id => [id, { [field]: tip }])) as Record<CanvasObjectIdType, Partial<CanvasObjectModel>>
        );
      }
    };

    return (
      <div>
        <AttributeMenuItem title={title}>
          <select
            name={field}
            value={(value as ArrowTip | undefined) ?? 'none'}
            onChange={onChangeArrowTip}
            className="w-20 mr-0"
          >
            {ARROW_TIP_OPTIONS.map(({ value: optionValue, label }) => (
              <option key={optionValue} value={optionValue}>{label}</option>
            ))}
          </select>
        </AttributeMenuItem>
      </div>
    );
  };

  return ArrowTipComponent;
};

export const AttributeArrowStart: AttributeDefinition = {
  name: "Start Tip",
  key: "arrowStart",
  Component: makeArrowTipComponent("Start Tip", "arrowStart", "SET_ARROW_START"),
};

export const AttributeArrowEnd: AttributeDefinition = {
  name: "End Tip",
  key: "arrowEnd",
  Component: makeArrowTipComponent("End Tip", "arrowEnd", "SET_ARROW_END"),
};
