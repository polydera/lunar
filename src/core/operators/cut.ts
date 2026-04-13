import * as tf from '@polydera/trueform'
import { operators } from '../registry'
import { intersectOptsInputs, buildIntersectOpts } from './intersectOpts'

const booleanOps: Record<string, (a: tf.Mesh, b: tf.Mesh) => any> = {
  union: tf.booleanUnion,
  intersection: tf.booleanIntersection,
  difference: tf.booleanDifference,
}

const booleanOpsAsync: Record<string, (a: tf.Mesh, b: tf.Mesh) => Promise<any>> = {
  union: tf.async.booleanUnion,
  intersection: tf.async.booleanIntersection,
  difference: tf.async.booleanDifference,
}

const booleanOpsWithCurves: Record<string, (a: tf.Mesh, b: tf.Mesh, opts: { returnCurves: true }) => any> = {
  union: tf.booleanUnion,
  intersection: tf.booleanIntersection,
  difference: tf.booleanDifference,
}

const booleanOpsAsyncWithCurves: Record<string, (a: tf.Mesh, b: tf.Mesh, opts: { returnCurves: true }) => Promise<any>> = {
  union: tf.async.booleanUnion,
  intersection: tf.async.booleanIntersection,
  difference: tf.async.booleanDifference,
}

operators.register({
  id: 'tf.boolean',
  label: 'Boolean',
  description: 'Perform a boolean operation (union, intersection, or difference) on two meshes.',
  category: 'cut',
  tags: ['boolean', 'csg', 'union', 'intersection', 'difference', 'subtract', 'combine'],
  docsUrl: 'https://trueform.polydera.com/ts/modules/cut#boolean-operations',
  expensive: true,
  inputs: [
    { name: 'meshA', label: 'Mesh A', type: 'mesh', description: 'First mesh' },
    { name: 'meshB', label: 'Mesh B', type: 'mesh', description: 'Second mesh' },
    {
      name: 'operation',
      label: 'Operation',
      type: 'string',
      description: 'Boolean operation type',
      enum: ['union', 'intersection', 'difference'],
      default: 'union',
    },
    {
      name: 'returnCurves',
      label: 'Return Curves',
      type: 'boolean',
      description: 'Include intersection curves',
      optional: true,
      default: false,
    },
  ],
  outputs: [
    { name: 'mesh', label: 'Result', type: 'mesh', description: 'Boolean result mesh', primary: true },
    { name: 'labels', label: 'Labels', type: 'ndarray', description: 'Per-face region labels' },
    { name: 'faceLabels', label: 'Face Labels', type: 'ndarray', description: 'Per-face source face index' },
    {
      name: 'curves',
      label: 'Curves',
      type: 'curves',
      description: 'Intersection curves',
      condition: { input: 'returnCurves', value: true },
    },
  ],
  sync: ({ meshA, meshB, operation, returnCurves }) => {
    const op = operation as string
    const __labels = { mesh: op[0]!.toUpperCase() + op.slice(1) }
    if (returnCurves)
      return {
        ...(booleanOpsWithCurves[op]!(meshA as tf.Mesh, meshB as tf.Mesh, { returnCurves: true }) as unknown as Record<
          string,
          unknown
        >),
        __labels,
      }
    return { ...(booleanOps[op]!(meshA as tf.Mesh, meshB as tf.Mesh) as unknown as Record<string, unknown>), __labels }
  },
  async: async ({ meshA, meshB, operation, returnCurves }) => {
    const op = operation as string
    const __labels = { mesh: op[0]!.toUpperCase() + op.slice(1) }
    if (returnCurves)
      return {
        ...((await booleanOpsAsyncWithCurves[op]!(meshA as tf.Mesh, meshB as tf.Mesh, {
          returnCurves: true,
        })) as unknown as Record<string, unknown>),
        __labels,
      }
    return {
      ...((await booleanOpsAsync[op]!(meshA as tf.Mesh, meshB as tf.Mesh)) as unknown as Record<string, unknown>),
      __labels,
    }
  },
})

operators.register({
  id: 'tf.embeddedIntersectionCurves',
  label: 'Embedded Intersection Curves',
  description: 'Split mesh A along its intersection with mesh B.',
  category: 'cut',
  tags: ['intersect', 'split', 'embed', 'curves'],
  docsUrl: 'https://trueform.polydera.com/ts/modules/cut#embedded-intersection-curves',
  expensive: true,
  inputs: [
    { name: 'meshA', label: 'Mesh A', type: 'mesh', description: 'Mesh to split' },
    { name: 'meshB', label: 'Mesh B', type: 'mesh', description: 'Cutting mesh' },
    ...intersectOptsInputs({ mode: 'primitives', resolveCrossings: false, resolveSelfCrossings: false }),
    {
      name: 'returnCurves',
      label: 'Return Curves',
      type: 'boolean',
      description: 'Include intersection curves',
      optional: true,
      default: false,
    },
  ],
  outputs: [
    { name: 'mesh', label: 'Result', type: 'mesh', description: 'Split mesh', primary: true },
    { name: 'faceLabels', label: 'Face Labels', type: 'ndarray', description: 'Per-face source labels' },
    {
      name: 'curves',
      label: 'Curves',
      type: 'curves',
      description: 'Intersection curves',
      condition: { input: 'returnCurves', value: true },
    },
  ],
  sync: (args) => {
    const opts = buildIntersectOpts(args)
    if (args.returnCurves) {
      return tf.embeddedIntersectionCurves(args.meshA as tf.Mesh, args.meshB as tf.Mesh, {
        ...opts,
        returnCurves: true,
      }) as unknown as Record<string, unknown>
    }
    return tf.embeddedIntersectionCurves(args.meshA as tf.Mesh, args.meshB as tf.Mesh, opts) as unknown as Record<
      string,
      unknown
    >
  },
  async: async (args) => {
    const opts = buildIntersectOpts(args)
    if (args.returnCurves) {
      return (await tf.async.embeddedIntersectionCurves(args.meshA as tf.Mesh, args.meshB as tf.Mesh, {
        ...opts,
        returnCurves: true,
      })) as unknown as Record<string, unknown>
    }
    return (await tf.async.embeddedIntersectionCurves(
      args.meshA as tf.Mesh,
      args.meshB as tf.Mesh,
      opts,
    )) as unknown as Record<string, unknown>
  },
})

operators.register({
  id: 'tf.embeddedSelfIntersectionCurves',
  label: 'Embedded Self-Intersection Curves',
  description: 'Split mesh along its self-intersection curves.',
  category: 'cut',
  tags: ['self-intersect', 'split', 'embed', 'curves'],
  docsUrl: 'https://trueform.polydera.com/ts/modules/cut#self-intersection',
  expensive: true,
  inputs: [
    { name: 'mesh', label: 'Mesh', type: 'mesh', description: 'Mesh to split' },
    ...intersectOptsInputs({ mode: 'primitives', resolveCrossings: true, resolveSelfCrossings: true }),
    {
      name: 'returnCurves',
      label: 'Return Curves',
      type: 'boolean',
      description: 'Include intersection curves',
      optional: true,
      default: false,
    },
  ],
  outputs: [
    {
      name: 'mesh',
      label: 'Result',
      type: 'mesh',
      description: 'Split mesh',
      primary: true,
      inheritTransformation: 'mesh',
    },
    { name: 'faceLabels', label: 'Face Labels', type: 'ndarray', description: 'Per-face source labels' },
    {
      name: 'curves',
      label: 'Curves',
      type: 'curves',
      description: 'Intersection curves',
      condition: { input: 'returnCurves', value: true },
    },
  ],
  sync: (args) => {
    const opts = buildIntersectOpts(args)
    if (args.returnCurves) {
      return tf.embeddedSelfIntersectionCurves(args.mesh as tf.Mesh, {
        ...opts,
        returnCurves: true,
      }) as unknown as Record<string, unknown>
    }
    return tf.embeddedSelfIntersectionCurves(args.mesh as tf.Mesh, opts) as unknown as Record<string, unknown>
  },
  async: async (args) => {
    const opts = buildIntersectOpts(args)
    if (args.returnCurves) {
      return (await tf.async.embeddedSelfIntersectionCurves(args.mesh as tf.Mesh, {
        ...opts,
        returnCurves: true,
      })) as unknown as Record<string, unknown>
    }
    return (await tf.async.embeddedSelfIntersectionCurves(args.mesh as tf.Mesh, opts)) as unknown as Record<string, unknown>
  },
})

operators.register({
  id: 'tf.meshArrangements',
  label: 'Mesh Arrangements',
  description: 'Decompose N meshes at their mutual intersections.',
  category: 'cut',
  tags: ['arrangement', 'decompose', 'intersect'],
  docsUrl: 'https://trueform.polydera.com/ts/modules/cut#mesh-arrangements',
  expensive: true,
  inputs: [
    { name: 'meshes', label: 'Meshes', type: 'mesh', description: 'Meshes to decompose', array: true },
    ...intersectOptsInputs({ mode: 'primitives', resolveCrossings: true, resolveSelfCrossings: false }),
    {
      name: 'returnCurves',
      label: 'Return Curves',
      type: 'boolean',
      description: 'Include intersection curves',
      optional: true,
      default: false,
    },
  ],
  outputs: [
    { name: 'mesh', label: 'Result', type: 'mesh', description: 'Decomposed mesh', primary: true },
    { name: 'tagLabels', label: 'Tag Labels', type: 'ndarray', description: 'Per-face tag labels' },
    { name: 'faceLabels', label: 'Face Labels', type: 'ndarray', description: 'Per-face source labels' },
    {
      name: 'curves',
      label: 'Curves',
      type: 'curves',
      description: 'Intersection curves',
      condition: { input: 'returnCurves', value: true },
    },
  ],
  sync: (args) => {
    const opts = buildIntersectOpts(args)
    if (args.returnCurves) {
      return tf.meshArrangements(args.meshes as unknown as tf.Mesh[], {
        ...opts,
        returnCurves: true,
      }) as unknown as Record<string, unknown>
    }
    return tf.meshArrangements(args.meshes as unknown as tf.Mesh[], opts) as unknown as Record<string, unknown>
  },
  async: async (args) => {
    const opts = buildIntersectOpts(args)
    if (args.returnCurves) {
      return (await tf.async.meshArrangements(args.meshes as unknown as tf.Mesh[], {
        ...opts,
        returnCurves: true,
      })) as unknown as Record<string, unknown>
    }
    return (await tf.async.meshArrangements(args.meshes as unknown as tf.Mesh[], opts)) as unknown as Record<string, unknown>
  },
})

operators.register({
  id: 'tf.polygonArrangements',
  label: 'Polygon Arrangements',
  description: 'Decompose mesh at its self-intersections.',
  category: 'cut',
  tags: ['arrangement', 'decompose', 'self-intersect'],
  docsUrl: 'https://trueform.polydera.com/ts/modules/cut#polygon-arrangements',
  expensive: true,
  inputs: [
    { name: 'mesh', label: 'Mesh', type: 'mesh', description: 'Mesh to decompose' },
    ...intersectOptsInputs({ mode: 'primitives', resolveCrossings: true, resolveSelfCrossings: true }),
    {
      name: 'returnCurves',
      label: 'Return Curves',
      type: 'boolean',
      description: 'Include intersection curves',
      optional: true,
      default: false,
    },
  ],
  outputs: [
    { name: 'mesh', label: 'Result', type: 'mesh', description: 'Decomposed mesh', primary: true },
    { name: 'faceLabels', label: 'Face Labels', type: 'ndarray', description: 'Per-face source labels' },
    {
      name: 'curves',
      label: 'Curves',
      type: 'curves',
      description: 'Intersection curves',
      condition: { input: 'returnCurves', value: true },
    },
  ],
  sync: (args) => {
    const opts = buildIntersectOpts(args)
    if (args.returnCurves) {
      return tf.polygonArrangements(args.mesh as tf.Mesh, { ...opts, returnCurves: true }) as unknown as Record<
        string,
        unknown
      >
    }
    return tf.polygonArrangements(args.mesh as tf.Mesh, opts) as unknown as Record<string, unknown>
  },
  async: async (args) => {
    const opts = buildIntersectOpts(args)
    if (args.returnCurves) {
      return (await tf.async.polygonArrangements(args.mesh as tf.Mesh, {
        ...opts,
        returnCurves: true,
      })) as unknown as Record<string, unknown>
    }
    return (await tf.async.polygonArrangements(args.mesh as tf.Mesh, opts)) as unknown as Record<string, unknown>
  },
})
