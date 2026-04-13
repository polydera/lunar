import type * as tf from '@polydera/trueform'
import type { Input } from '@/core'

export interface IntersectOptsDefaults {
  mode: 'sos' | 'primitives'
  resolveCrossings: boolean
  resolveSelfCrossings: boolean
}

/** Shared UI inputs for trueform's IntersectOpts. Each operator passes its own defaults. */
export function intersectOptsInputs(defaults: IntersectOptsDefaults): Input[] {
  return [
    {
      name: 'mode',
      label: 'Mode',
      type: 'string',
      description: 'Intersection algorithm: sos (fast) or primitives (handles shared geometry)',
      enum: ['sos', 'primitives'],
      default: defaults.mode,
      optional: true,
    },
    {
      name: 'resolveCrossings',
      label: 'Resolve Crossings',
      type: 'boolean',
      description: 'Resolve crossings between different contours on the same face',
      default: defaults.resolveCrossings,
      optional: true,
    },
    {
      name: 'resolveSelfCrossings',
      label: 'Resolve Self-Crossings',
      type: 'boolean',
      description: 'Resolve self-crossings within a single contour',
      default: defaults.resolveSelfCrossings,
      optional: true,
    },
  ]
}

export function buildIntersectOpts(args: Record<string, unknown>): tf.IntersectOpts {
  return {
    mode: args.mode as 'sos' | 'primitives',
    resolveCrossings: args.resolveCrossings as boolean,
    resolveSelfCrossings: args.resolveSelfCrossings as boolean,
  }
}
