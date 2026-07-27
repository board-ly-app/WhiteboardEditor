// === shadowProps =============================================================
//
// Shared Konva shadow config for canvas objects with the shadow attribute
// enabled. The shadow value is the blur radius in px; 0 (or absent) disables
// the shadow. Spread the result onto any Konva shape node.
//
// =============================================================================

import type Konva from 'konva';

const SHADOW_CONFIG = {
  shadowColor: '#000000',
  shadowOffsetX: 4,
  shadowOffsetY: 4,
  shadowOpacity: 0.35,
};

export const shadowProps = (shadow: number | undefined): Partial<Konva.ShapeConfig> => ({
  ...SHADOW_CONFIG,
  shadowBlur: shadow ?? 0,
  shadowEnabled: (shadow ?? 0) > 0,
});
