// === shadowProps =============================================================
//
// Shared Konva shadow config for canvas objects with the shadow attribute
// enabled. Spread the result onto any Konva shape node.
//
// =============================================================================

import type Konva from 'konva';

const SHADOW_CONFIG = {
  shadowColor: '#000000',
  shadowBlur: 10,
  shadowOffsetX: 4,
  shadowOffsetY: 4,
  shadowOpacity: 0.35,
};

export const shadowProps = (shadow: boolean | undefined): Partial<Konva.ShapeConfig> => ({
  ...SHADOW_CONFIG,
  shadowEnabled: shadow === true,
});
