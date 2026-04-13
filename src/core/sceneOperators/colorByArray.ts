import type * as tf from '@polydera/trueform'
import { operands } from '../operands'
import { sceneOperators } from '../sceneOperatorRegistry'
import { COLOR_MAP_NAMES, type ColorMapName } from '../colorMapNames'
import { prefs } from '@/composables/usePreferences'

const ID = 'style.colorByArray'
const DEFAULT_CLIP = 2

/**
 * Internal shape of the per-node args dict written by this scene operator.
 * Viewport reads this same shape from `node.sceneOperatorState[ID]`.
 */
export interface ColorByArrayArgs {
  /** Operand id of the selected ndarray child, or `null` for "no source". */
  array: string | null
  colorMap: ColorMapName
  clip: number
}

export function readColorByArray(
  nodeSceneOperatorState: Record<string, Record<string, unknown>> | undefined,
): ColorByArrayArgs | undefined {
  const raw = nodeSceneOperatorState?.[ID] as ColorByArrayArgs | undefined
  if (!raw) return undefined
  return raw
}

sceneOperators.register({
  id: ID,
  label: 'Color by Array',
  description: 'Color each vertex by a child ndarray sampled through a colormap.',
  category: 'style',
  tags: ['color', 'colormap', 'scalar', 'array', 'visualize'],
  inputs: [
    {
      name: 'mesh',
      label: 'Mesh',
      type: 'mesh',
      description: 'Mesh to color',
      childInput: {
        name: 'array',
        label: 'Array',
        type: 'ndarray',
        description: 'Per-vertex scalar data',
        optional: true,
        // Only per-vertex ndarrays (shape[0] === number of mesh points).
        filter: (child, parent) => {
          const arr = child as tf.NDArray
          const mesh = parent as tf.Mesh
          return arr.shape[0] === mesh.numberOfPoints
        },
      },
    },
    {
      name: 'colorMap',
      label: 'Colormap',
      type: 'string',
      description: 'Colormap lookup table',
      enum: [...COLOR_MAP_NAMES],
      default: prefs.defaultColormap,
    },
    {
      name: 'clip',
      label: 'Outlier',
      type: 'number',
      description: 'Percent clipped from each side of the value distribution',
      default: DEFAULT_CLIP,
      min: 0,
      max: 25,
      step: 0.5,
    },
  ],
  apply(nodeId, args, scene) {
    // Preserve colormap/clip on the node even when the user hasn't picked a source yet.
    // `array: null` means "no source" — the node renders solid but the user's
    // chosen colormap and outlier settings are retained across source changes.
    let arrayOperandId: string | null = (args.array as string | null | undefined) ?? null
    if (arrayOperandId) {
      const operand = operands.get(arrayOperandId)
      if (!operand || operand.type !== 'ndarray') arrayOperandId = null
    }
    const next: ColorByArrayArgs = {
      array: arrayOperandId,
      colorMap: (args.colorMap as ColorMapName | undefined) ?? prefs.defaultColormap,
      clip: (args.clip as number | undefined) ?? DEFAULT_CLIP,
    }
    scene.setSceneOperatorArgs(nodeId, ID, next as unknown as Record<string, unknown>)
  },
  read(nodeId, scene) {
    const existing = scene.getSceneOperatorArgs(nodeId, ID) as ColorByArrayArgs | undefined
    return {
      array: existing?.array ?? null,
      colorMap: existing?.colorMap ?? prefs.defaultColormap,
      clip: existing?.clip ?? DEFAULT_CLIP,
    }
  },
  onOperandRemoved(nodeId, removedOperandId, scene) {
    const existing = scene.getSceneOperatorArgs(nodeId, ID) as ColorByArrayArgs | undefined
    if (!existing || existing.array !== removedOperandId) return
    // Null the dangling array reference but keep the colormap / clip settings.
    scene.setSceneOperatorArgs(nodeId, ID, { ...existing, array: null } as unknown as Record<string, unknown>)
  },
})
