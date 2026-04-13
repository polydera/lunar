import type * as tf from '@polydera/trueform'
import { operands } from '../operands'
import { sceneOperators } from '../sceneOperatorRegistry'

const ID = 'style.shading'

export type ShadingVariant = 'flat' | 'smooth' | 'normals'

/**
 * Internal shape of the per-node args dict written by this scene operator.
 * Viewport reads this same shape from `node.sceneOperatorState[ID]`.
 */
export interface ShadingArgs {
  variant: ShadingVariant
  /** Operand id of the selected normals ndarray child (shape [V, 3]), or null. */
  normals: string | null
}

export function readShading(
  nodeSceneOperatorState: Record<string, Record<string, unknown>> | undefined,
): ShadingArgs | undefined {
  const raw = nodeSceneOperatorState?.[ID] as ShadingArgs | undefined
  if (!raw) return undefined
  return raw
}

sceneOperators.register({
  id: ID,
  label: 'Shading',
  description: 'Choose how the mesh is shaded: flat, smooth, or from a per-vertex normals array.',
  category: 'style',
  tags: ['shading', 'flat', 'smooth', 'normals'],
  inputs: [
    {
      name: 'mesh',
      label: 'Mesh',
      type: 'mesh',
      description: 'Mesh to shade',
      childInput: {
        name: 'normals',
        label: 'Normals',
        type: 'ndarray',
        description: 'Per-vertex normals array [V, 3]',
        // Only per-vertex ndarrays shaped [V, 3].
        filter: (child, parent) => {
          const arr = child as tf.NDArray
          const mesh = parent as tf.Mesh
          return arr.shape[0] === mesh.numberOfPoints && arr.shape[1] === 3
        },
      },
    },
    {
      name: 'variant',
      label: 'Variant',
      type: 'string',
      description: 'Shading mode',
      enum: ['flat', 'smooth', 'normals'],
      default: 'flat',
    },
  ],
  apply(nodeId, args, scene) {
    let normalsOperandId: string | null = (args.normals as string | null | undefined) ?? null
    if (normalsOperandId) {
      const operand = operands.get(normalsOperandId)
      if (!operand || operand.type !== 'ndarray') normalsOperandId = null
    }
    const next: ShadingArgs = {
      variant: (args.variant as ShadingVariant | undefined) ?? 'flat',
      normals: normalsOperandId,
    }
    scene.setSceneOperatorArgs(nodeId, ID, next as unknown as Record<string, unknown>)
  },
  read(nodeId, scene) {
    const existing = scene.getSceneOperatorArgs(nodeId, ID) as ShadingArgs | undefined
    return {
      variant: existing?.variant ?? 'flat',
      normals: existing?.normals ?? null,
    }
  },
  onOperandRemoved(nodeId, removedOperandId, scene) {
    const existing = scene.getSceneOperatorArgs(nodeId, ID) as ShadingArgs | undefined
    if (!existing || existing.normals !== removedOperandId) return
    // Null the dangling normals reference but keep the variant.
    scene.setSceneOperatorArgs(nodeId, ID, { ...existing, normals: null } as unknown as Record<string, unknown>)
  },
})
