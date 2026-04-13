import * as tf from '@polydera/trueform'
import { operators } from '../registry'
import { copyTransform } from '../utils'

operators.register({
  id: 'tf.decimated',
  label: 'Decimate',
  description: 'Reduce face count using quadric error metrics. Collapses edges in priority order.',
  category: 'remesh',
  tags: ['decimate', 'simplify', 'reduce', 'lod'],
  docsUrl: 'https://trueform.polydera.com/ts/modules/remesh#decimation',
  expensive: true,
  inputs: [
    { name: 'mesh', label: 'Mesh', type: 'mesh', description: 'Triangle mesh to decimate' },
    {
      name: 'targetProportion',
      label: 'Target Proportion',
      type: 'number',
      description: 'Target face count as fraction of original',
      default: 0.5,
      min: 0.01,
      max: 1,
      step: 0.01,
    },
    {
      name: 'preserveBoundary',
      label: 'Preserve Boundary',
      type: 'boolean',
      description: 'Never collapse boundary edges',
      optional: true,
      default: true,
    },
    {
      name: 'featureAngle',
      label: 'Feature Angle',
      type: 'number',
      description: 'Feature edge detection angle in degrees (-1 disables)',
      optional: true,
      default: 60,
      min: -1,
      max: 180,
      step: 1,
    },
  ],
  outputs: [{ name: 'mesh', label: 'Result', type: 'mesh', description: 'Decimated mesh' }],
  sync: ({ mesh, targetProportion, ...opts }) => {
    const input = mesh as tf.Mesh
    const result = tf.decimated(input, targetProportion as number, opts as tf.DecimateOptions)
    copyTransform(input, result)
    return { mesh: result }
  },
  async: async ({ mesh, targetProportion, ...opts }) => {
    const input = mesh as tf.Mesh
    const result = await tf.async.decimated(input, targetProportion as number, opts as tf.DecimateOptions)
    copyTransform(input, result)
    return { mesh: result }
  },
})

operators.register({
  id: 'tf.isotropicRemeshed',
  label: 'Isotropic Remesh',
  description:
    'Redistribute vertices for uniform edge lengths. Splits long edges, collapses short ones, flips for valence, relaxes tangentially.',
  category: 'remesh',
  tags: ['remesh', 'isotropic', 'uniform', 'quality'],
  docsUrl: 'https://trueform.polydera.com/ts/modules/remesh#isotropic-remeshing',
  expensive: true,
  inputs: [
    { name: 'mesh', label: 'Mesh', type: 'mesh', description: 'Triangle mesh to remesh' },
    {
      name: 'multiplier',
      label: 'Edge Length Multiplier',
      type: 'number',
      description: 'Target edge length as multiplier of mean edge length (1 = same density)',
      default: 1,
      min: 0.1,
      max: 5,
      step: 0.1,
    },
    {
      name: 'iterations',
      label: 'Iterations',
      type: 'number',
      description: 'Number of outer iterations',
      optional: true,
      default: 3,
      min: 1,
      max: 20,
      step: 1,
    },
    {
      name: 'preserveBoundary',
      label: 'Preserve Boundary',
      type: 'boolean',
      description: 'Never split or collapse boundary edges',
      optional: true,
      default: true,
    },
    {
      name: 'featureAngle',
      label: 'Feature Angle',
      type: 'number',
      description: 'Preserve edges sharper than this angle in degrees (-1 disables)',
      optional: true,
      default: 60,
      min: -1,
      max: 180,
      step: 1,
    },
  ],
  outputs: [{ name: 'mesh', label: 'Result', type: 'mesh', description: 'Remeshed mesh with uniform edges' }],
  sync: ({ mesh, multiplier, ...opts }) => {
    const input = mesh as tf.Mesh
    const targetLength = tf.meanEdgeLength(input) * (multiplier as number)
    const result = tf.isotropicRemeshed(input, targetLength, opts as tf.RemeshOptions)
    copyTransform(input, result)
    return { mesh: result }
  },
  async: async ({ mesh, multiplier, ...opts }) => {
    const input = mesh as tf.Mesh
    const targetLength = (await tf.async.meanEdgeLength(input)) * (multiplier as number)
    const result = await tf.async.isotropicRemeshed(input, targetLength, opts as tf.RemeshOptions)
    copyTransform(input, result)
    return { mesh: result }
  },
})
