/**
 * Named colormap identifiers used by both the rendering side (src/viewport/colorMaps.ts)
 * and scene operators that configure colormap state (e.g. colorByArray).
 *
 * Neutral location: no runtime imports in either direction.
 *
 * `polydera` is the brand colormap. It is adaptive: sequential (teal → orange)
 * for unsigned data, diverging (orange ↔ gray ↔ teal) when the data crosses
 * zero. The switch happens inside buildColorBuffer based on the clipped range.
 */
export type ColorMapName = 'polydera' | 'viridis' | 'plasma' | 'turbo' | 'grayscale' | 'rainbow'

export const COLOR_MAP_NAMES: readonly ColorMapName[] = [
  'polydera',
  'viridis',
  'plasma',
  'turbo',
  'grayscale',
  'rainbow',
] as const
