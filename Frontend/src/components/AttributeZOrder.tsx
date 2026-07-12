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

import {
  Button,
} from '@/components/ui/button';

const ZOrderComponent = ({
  selectedShapeIds,
  handleUpdateShapes,
  canvasId,
}: AttributeProps) => {
  const canvasObjectsById = useSelector(
    (state: RootState) => selectCanvasObjectsByCanvas(state, canvasId),
    lodash.isEqual
  );

  // z-order only applies to an existing selection; hide in tool mode, where
  // dispatchers reuse this attribute list but nothing is selected
  if (selectedShapeIds.length === 0) {
    return null;
  }

  const effectiveZIndex = (id: CanvasObjectIdType): number =>
    canvasObjectsById?.[id]?.zIndex ?? 0;

  // selection sorted by current stacking order, so relative order is
  // preserved when multiple shapes are moved at once
  const sortedSelection = (): CanvasObjectIdType[] =>
    [...selectedShapeIds].sort((idA, idB) => {
      const zA = effectiveZIndex(idA);
      const zB = effectiveZIndex(idB);

      if (zA !== zB) {
        return zA - zB;
      }

      return idA < idB ? -1 : (idA > idB ? 1 : 0);
    });

  const updateZIndexes = (assignZIndex: (allZIndexes: number[], position: number) => number) => {
    if (! canvasObjectsById || selectedShapeIds.length === 0) {
      return;
    }

    const allZIndexes = Object.values(canvasObjectsById).map(obj => obj.zIndex ?? 0);

    handleUpdateShapes(
      canvasId,
      canvasObjectsById,
      Object.fromEntries(sortedSelection().map((id, i) => [
        id,
        { zIndex: assignZIndex(allZIndexes, i) },
      ])) as Record<CanvasObjectIdType, Partial<CanvasObjectModel>>
    );
  };

  const onBringToFront = () => {
    updateZIndexes((allZIndexes, i) => Math.max(0, ...allZIndexes) + 1 + i);
  };

  const onSendToBack = () => {
    updateZIndexes(
      (allZIndexes, i) => Math.min(0, ...allZIndexes) - selectedShapeIds.length + i
    );
  };

  return (
    <div className="flex gap-1 mt-1 me-2">
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={onBringToFront}
      >
        To front
      </Button>
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={onSendToBack}
      >
        To back
      </Button>
    </div>
  );
}

const AttributeZOrder: AttributeDefinition = {
  name: "Order",
  key: "zIndex",
  Component: ZOrderComponent,
}

export default AttributeZOrder;
