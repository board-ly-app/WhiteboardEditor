import {
  useSelector,
} from 'react-redux';

import lodash from 'lodash';

import {
  AlignLeft,
  AlignCenter,
  AlignRight,
  AlignStartHorizontal,
  AlignCenterHorizontal,
  AlignEndHorizontal,
  type LucideIcon,
} from 'lucide-react';

import {
  type RootState,
} from '@/store';

import {
  selectCanvasObjectsByCanvas,
} from '@/store/canvasObjects/canvasObjectsSelectors';

import type { AttributeDefinition, AttributeProps } from "@/types/Attribute";
import type {
  CanvasObjectIdType,
  CanvasObjectModel,
  TextAlign,
  TextVerticalAlign,
} from "@/types/CanvasObjectModel";
import type { ShapeAttributesAction } from "@/reducers/shapeAttributesReducer";

interface AlignSpec<AlignType extends TextAlign | TextVerticalAlign> {
  title: string;
  field: 'align' | 'verticalAlign';
  actionType: Extract<ShapeAttributesAction, { payload: AlignType }>['type'];
  defaultValue: AlignType;
  options: { value: AlignType; label: string; Icon: LucideIcon }[];
}

const makeAlignComponent = <AlignType extends TextAlign | TextVerticalAlign>({
  title,
  field,
  actionType,
  defaultValue,
  options,
}: AlignSpec<AlignType>) => {
  const AlignComponent = ({
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

    const currentValue = (value as AlignType | undefined) ?? defaultValue;

    const onChangeAlign = (align: AlignType) => {
      dispatch({ type: actionType, payload: align } as ShapeAttributesAction);

      if (canvasObjectsById) {
        handleUpdateShapes(
          canvasId,
          canvasObjectsById,
          Object.fromEntries(selectedShapeIds.map(id => [id, { [field]: align }])) as Record<CanvasObjectIdType, Partial<CanvasObjectModel>>
        );
      }
    };

    return (
      <div
        role="radiogroup"
        aria-label={title}
        className="flex gap-0.5 border rounded p-0"
      >
        {options.map(({ value: optionValue, label, Icon }) => (
          <label
            key={optionValue}
            title={label}
            className={`p-1 rounded cursor-pointer border ${
              currentValue === optionValue
                ? 'bg-primary text-primary-foreground border-border'
                : 'border-transparent hover:bg-accent'
            }`}
          >
            <input
              type="radio"
              name={field}
              value={optionValue}
              checked={currentValue === optionValue}
              onChange={() => onChangeAlign(optionValue)}
              className="sr-only"
            />
            <Icon size={16} aria-hidden="true" />
          </label>
        ))}
      </div>
    );
  };

  return AlignComponent;
};

export const AttributeTextAlign: AttributeDefinition = {
  name: "Align",
  key: "align",
  inline: true,
  Component: makeAlignComponent<TextAlign>({
    title: "Align",
    field: "align",
    actionType: "SET_TEXT_ALIGN",
    defaultValue: "left",
    options: [
      { value: 'left', label: 'Align left', Icon: AlignLeft },
      { value: 'center', label: 'Align center', Icon: AlignCenter },
      { value: 'right', label: 'Align right', Icon: AlignRight },
    ],
  }),
};

export const AttributeTextVerticalAlign: AttributeDefinition = {
  name: "Vertical Align",
  key: "verticalAlign",
  inline: true,
  Component: makeAlignComponent<TextVerticalAlign>({
    title: "Vertical Align",
    field: "verticalAlign",
    actionType: "SET_TEXT_VERTICAL_ALIGN",
    defaultValue: "top",
    options: [
      { value: 'top', label: 'Align top', Icon: AlignStartHorizontal },
      { value: 'middle', label: 'Align middle', Icon: AlignCenterHorizontal },
      { value: 'bottom', label: 'Align bottom', Icon: AlignEndHorizontal },
    ],
  }),
};
