import * as tf from '@polydera/trueform'
import { operators } from '../registry'
import { intersectOptsInputs, buildIntersectOpts } from './intersectOpts'

operators.register({
  id: 'tf.intersectionCurves',
  label: 'Intersection Curves',
  description: 'Compute intersection curves between meshes. Returns polylines where surfaces cross.',
  category: 'intersect',
  tags: ['intersection', 'curves', 'cross'],
  docsUrl: 'https://trueform.polydera.com/ts/modules/intersect#intersection-curves',
  expensive: true,
  inputs: [
    { name: 'meshes', label: 'Meshes', type: 'mesh', description: 'Meshes to intersect', array: true },
    ...intersectOptsInputs({ mode: 'sos', resolveCrossings: true, resolveSelfCrossings: false }),
  ],
  outputs: [
    {
      name: 'curves',
      label: 'Intersection',
      type: 'curves',
      description: 'Intersection polylines',
    },
  ],
  sync: (args) => ({
    curves: tf.intersectionCurves(args.meshes as tf.Mesh[], buildIntersectOpts(args)),
  }),
  async: async (args) => ({
    curves: await tf.async.intersectionCurves(args.meshes as tf.Mesh[], buildIntersectOpts(args)),
  }),
})

operators.register({
  id: 'tf.selfIntersectionCurves',
  label: 'Self-Intersection Curves',
  description: 'Find self-intersection curves of a mesh.',
  category: 'intersect',
  tags: ['self-intersect', 'curves'],
  docsUrl: 'https://trueform.polydera.com/ts/modules/intersect#self-intersection-curves',
  expensive: true,
  outputAsChild: true,
  inputs: [
    { name: 'mesh', label: 'Mesh', type: 'mesh', description: 'Mesh to check' },
    ...intersectOptsInputs({ mode: 'sos', resolveCrossings: true, resolveSelfCrossings: true }),
  ],
  outputs: [{ name: 'curves', label: 'Self-Intersection', type: 'curves', description: 'Self-intersection curves' }],
  sync: (args) => ({ curves: tf.selfIntersectionCurves(args.mesh as tf.Mesh, buildIntersectOpts(args)) }),
  async: async (args) => ({
    curves: await tf.async.selfIntersectionCurves(args.mesh as tf.Mesh, buildIntersectOpts(args)),
  }),
})
