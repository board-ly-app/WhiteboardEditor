// === dragConstraints =========================================================
//
// Helpers for constraining shape-drawing drags while the shift key is held.
// Each takes the drag origin (pointer down position) and the current pointer
// position, and returns an adjusted pointer position.
//
// =============================================================================

import type {
  EventCoords,
} from '@/types/EventCoords';

// -- constrain the drag box to a square: both sides take the longer dragged
// -- axis, preserving the drag direction. Yields perfect squares for rects and
// -- perfect circles for ellipses.
export const constrainToSquare = (
  origin: EventCoords,
  point: EventCoords
): EventCoords => {
  const dx = point.x - origin.x;
  const dy = point.y - origin.y;
  const size = Math.max(Math.abs(dx), Math.abs(dy));

  return ({
    x: origin.x + ((dx >= 0) ? size : -size),
    y: origin.y + ((dy >= 0) ? size : -size),
  });
};// -- end constrainToSquare

// -- snap the dragged segment to the nearest 45-degree increment (horizontal,
// -- vertical, or diagonal), preserving its length
export const constrainToAngle = (
  origin: EventCoords,
  point: EventCoords
): EventCoords => {
  const dx = point.x - origin.x;
  const dy = point.y - origin.y;
  const length = Math.hypot(dx, dy);

  const snapIncrement = Math.PI / 4;
  const angle = Math.round(Math.atan2(dy, dx) / snapIncrement) * snapIncrement;

  return ({
    x: origin.x + length * Math.cos(angle),
    y: origin.y + length * Math.sin(angle),
  });
};// -- end constrainToAngle
