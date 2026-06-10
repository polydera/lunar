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
      name: 'minQuality',
      label: 'Min Quality',
      type: 'number',
      description: 'Quality floor for collapsed triangles, 0–1 (1 = equilateral). -1 disables, 0 = never worsen.',
      optional: true,
      default: -1,
      min: -1,
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
      name: 'minQuality',
      label: 'Min Quality',
      type: 'number',
      description: 'Quality floor for collapsed triangles, 0–1 (1 = equilateral). -1 disables, 0 = never worsen.',
      optional: true,
      default: 0.3,
      min: -1,
      max: 1,
      step: 0.01,
    },
    {
      name: 'useQuadric',
      label: 'Quadric Placement',
      type: 'boolean',
      description: 'Use QEM for vertex placement during collapses. Preserves sharp features better.',
      optional: true,
      default: false,
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

operators.register({
  id: 'tf.simplified',
  label: 'Simplify',
  description:
    'Reduce mesh complexity to an error budget using quadric error metrics, with iterative quality cleanup between rounds.',
  category: 'remesh',
  tags: ['simplify', 'reduce', 'lod', 'qem', 'error budget'],
  docsUrl: 'https://trueform.polydera.com/ts/modules/remesh#simplification',
  expensive: true,
  inputs: [
    { name: 'mesh', label: 'Mesh', type: 'mesh', description: 'Triangle mesh to simplify' },
    {
      name: 'errorRel',
      label: 'Error Budget',
      type: 'number',
      description: 'Error threshold as a fraction of the mesh bounding-box diagonal',
      default: 0.0005,
      min: 0.00001,
      max: 0.001,
      step: 0.000001,
    },
    {
      name: 'optimizeIterations',
      label: 'Cleanup Rounds',
      type: 'number',
      description: 'Quality cleanup rounds (edge flip + tangential relaxation) per outer iteration. 0 = pure collapse.',
      optional: true,
      default: 3,
      min: 0,
      max: 10,
      step: 1,
    },
    {
      name: 'iterations',
      label: 'Iterations',
      type: 'number',
      description: 'Outer collapse rounds. 1 = single pass; >1 removes more at the cost of more deviation.',
      optional: true,
      default: 1,
      min: 1,
      max: 5,
      step: 1,
    },
    {
      name: 'minQuality',
      label: 'Min Quality',
      type: 'number',
      description: 'Quality floor for collapsed triangles, 0–1 (1 = equilateral). -1 disables, 0 = never worsen.',
      optional: true,
      default: 0.3,
      min: -1,
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
      description: 'Preserve edges sharper than this angle in degrees (-1 disables)',
      optional: true,
      default: 60,
      min: -1,
      max: 180,
      step: 1,
    },
  ],
  outputs: [{ name: 'mesh', label: 'Result', type: 'mesh', description: 'Simplified mesh' }],
  sync: ({ mesh, ...opts }) => {
    const input = mesh as tf.Mesh
    const result = tf.simplified(input, opts as tf.SimplifyOptions)
    copyTransform(input, result)
    return { mesh: result }
  },
  async: async ({ mesh, ...opts }) => {
    const input = mesh as tf.Mesh
    const result = await tf.async.simplified(input, opts as tf.SimplifyOptions)
    copyTransform(input, result)
    return { mesh: result }
  },
})
