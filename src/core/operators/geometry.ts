import * as tf from '@polydera/trueform'
import { operators } from '../registry'
import { copyTransform } from '../utils'

operators.register({
  id: 'tf.sphereMesh',
  label: 'Sphere',
  description: 'Generate a UV sphere mesh centered at origin.',
  category: 'geometry',
  tags: ['primitive', 'generate', 'sphere'],
  docsUrl: 'https://trueform.polydera.com/ts/modules/geometry#mesh-generation',
  inputs: [
    {
      name: 'radius',
      label: 'Radius',
      type: 'number',
      description: 'Sphere radius',
      default: 1,
      min: 0.01,
      step: 0.1,
      unit: 'length',
    },
    {
      name: 'stacks',
      label: 'Stacks',
      type: 'number',
      description: 'Latitude subdivisions',
      default: 32,
      min: 3,
      max: 128,
      step: 1,
    },
    {
      name: 'segments',
      label: 'Segments',
      type: 'number',
      description: 'Longitude subdivisions',
      default: 32,
      min: 3,
      max: 128,
      step: 1,
    },
  ],
  outputs: [{ name: 'mesh', label: 'Mesh', type: 'mesh', description: 'Generated sphere mesh' }],
  sync: ({ radius, stacks, segments }) => ({ mesh: tf.sphereMesh(radius as number, stacks as number, segments as number) }),
  async: async ({ radius, stacks, segments }) => ({
    mesh: await tf.async.sphereMesh(radius as number, stacks as number, segments as number),
  }),
})

operators.register({
  id: 'tf.boxMesh',
  label: 'Box',
  description: 'Generate an axis-aligned box mesh centered at origin.',
  category: 'geometry',
  tags: ['primitive', 'generate', 'box', 'cube'],
  docsUrl: 'https://trueform.polydera.com/ts/modules/geometry#mesh-generation',
  inputs: [
    {
      name: 'width',
      label: 'Width',
      type: 'number',
      description: 'Width (x-axis)',
      default: 1,
      min: 0.01,
      step: 0.1,
      unit: 'length',
    },
    {
      name: 'height',
      label: 'Height',
      type: 'number',
      description: 'Height (y-axis)',
      default: 1,
      min: 0.01,
      step: 0.1,
      unit: 'length',
    },
    {
      name: 'depth',
      label: 'Depth',
      type: 'number',
      description: 'Depth (z-axis)',
      default: 1,
      min: 0.01,
      step: 0.1,
      unit: 'length',
    },
    {
      name: 'widthTicks',
      label: 'Width Ticks',
      type: 'number',
      description: 'Subdivisions along x-axis',
      default: 1,
      min: 1,
      max: 128,
      step: 1,
    },
    {
      name: 'heightTicks',
      label: 'Height Ticks',
      type: 'number',
      description: 'Subdivisions along y-axis',
      default: 1,
      min: 1,
      max: 128,
      step: 1,
    },
    {
      name: 'depthTicks',
      label: 'Depth Ticks',
      type: 'number',
      description: 'Subdivisions along z-axis',
      default: 1,
      min: 1,
      max: 128,
      step: 1,
    },
  ],
  outputs: [{ name: 'mesh', label: 'Mesh', type: 'mesh', description: 'Generated box mesh' }],
  sync: ({ width, height, depth, widthTicks, heightTicks, depthTicks }) => ({
    mesh: tf.boxMesh(
      width as number,
      height as number,
      depth as number,
      widthTicks as number,
      heightTicks as number,
      depthTicks as number,
    ),
  }),
  async: async ({ width, height, depth, widthTicks, heightTicks, depthTicks }) => ({
    mesh: await tf.async.boxMesh(
      width as number,
      height as number,
      depth as number,
      widthTicks as number,
      heightTicks as number,
      depthTicks as number,
    ),
  }),
})

operators.register({
  id: 'tf.cylinderMesh',
  label: 'Cylinder',
  description: 'Generate a cylinder mesh centered at origin.',
  category: 'geometry',
  tags: ['primitive', 'generate', 'cylinder'],
  docsUrl: 'https://trueform.polydera.com/ts/modules/geometry#mesh-generation',
  inputs: [
    {
      name: 'radius',
      label: 'Radius',
      type: 'number',
      description: 'Cylinder radius',
      default: 1,
      min: 0.01,
      step: 0.1,
      unit: 'length',
    },
    {
      name: 'height',
      label: 'Height',
      type: 'number',
      description: 'Cylinder height',
      default: 2,
      min: 0.01,
      step: 0.1,
      unit: 'length',
    },
    {
      name: 'segments',
      label: 'Segments',
      type: 'number',
      description: 'Radial subdivisions',
      default: 32,
      min: 3,
      max: 128,
      step: 1,
    },
  ],
  outputs: [{ name: 'mesh', label: 'Mesh', type: 'mesh', description: 'Generated cylinder mesh' }],
  sync: ({ radius, height, segments }) => ({
    mesh: tf.cylinderMesh(radius as number, height as number, segments as number),
  }),
  async: async ({ radius, height, segments }) => ({
    mesh: await tf.async.cylinderMesh(radius as number, height as number, segments as number),
  }),
})

operators.register({
  id: 'tf.planeMesh',
  label: 'Plane',
  description: 'Generate a flat rectangular plane mesh in the XY plane, centered at origin.',
  category: 'geometry',
  tags: ['primitive', 'generate', 'plane', 'quad'],
  docsUrl: 'https://trueform.polydera.com/ts/modules/geometry#mesh-generation',
  inputs: [
    {
      name: 'width',
      label: 'Width',
      type: 'number',
      description: 'Width (x-axis)',
      default: 1,
      min: 0.01,
      step: 0.1,
      unit: 'length',
    },
    {
      name: 'height',
      label: 'Height',
      type: 'number',
      description: 'Height (y-axis)',
      default: 1,
      min: 0.01,
      step: 0.1,
      unit: 'length',
    },
    {
      name: 'widthTicks',
      label: 'Width Ticks',
      type: 'number',
      description: 'Subdivisions along x-axis',
      default: 1,
      min: 1,
      max: 128,
      step: 1,
    },
    {
      name: 'heightTicks',
      label: 'Height Ticks',
      type: 'number',
      description: 'Subdivisions along y-axis',
      default: 1,
      min: 1,
      max: 128,
      step: 1,
    },
  ],
  outputs: [{ name: 'mesh', label: 'Mesh', type: 'mesh', description: 'Generated plane mesh' }],
  sync: ({ width, height, widthTicks, heightTicks }) => ({
    mesh: tf.planeMesh(width as number, height as number, widthTicks as number, heightTicks as number),
  }),
  async: async ({ width, height, widthTicks, heightTicks }) => ({
    mesh: await tf.async.planeMesh(width as number, height as number, widthTicks as number, heightTicks as number),
  }),
})

operators.register({
  id: 'tf.area',
  label: 'Surface Area',
  description: 'Compute the total surface area of a mesh. Respects mesh transformation.',
  category: 'geometry',
  tags: ['measure', 'area', 'surface'],
  docsUrl: 'https://trueform.polydera.com/ts/modules/geometry#area',
  inputs: [{ name: 'mesh', label: 'Mesh', type: 'mesh', description: 'Mesh to measure' }],
  outputs: [{ name: 'area', label: 'Area', type: 'number', description: 'Total surface area' }],
  sync: ({ mesh }) => ({ area: tf.area(mesh as tf.Mesh) }),
  async: async ({ mesh }) => ({ area: await tf.async.area(mesh as tf.Mesh) }),
})

operators.register({
  id: 'tf.volume',
  label: 'Volume',
  description: 'Compute the absolute volume of a closed mesh. Respects mesh transformation.',
  category: 'geometry',
  tags: ['measure', 'volume'],
  docsUrl: 'https://trueform.polydera.com/ts/modules/geometry#volume',
  inputs: [{ name: 'mesh', label: 'Mesh', type: 'mesh', description: 'Closed mesh to measure' }],
  outputs: [{ name: 'volume', label: 'Volume', type: 'number', description: 'Absolute volume' }],
  sync: ({ mesh }) => ({ volume: tf.volume(mesh as tf.Mesh) }),
  async: async ({ mesh }) => ({ volume: await tf.async.volume(mesh as tf.Mesh) }),
})

operators.register({
  id: 'tf.positivelyOriented',
  label: 'Orient Outward',
  description: 'Orient mesh normals to point outward (consistent winding + positive signed volume).',
  category: 'geometry',
  tags: ['orient', 'normals', 'winding', 'outward'],
  docsUrl: 'https://trueform.polydera.com/ts/modules/geometry#orientation',
  inputs: [{ name: 'mesh', label: 'Mesh', type: 'mesh', description: 'Mesh to orient' }],
  outputs: [{ name: 'mesh', label: 'Result', type: 'mesh', description: 'Outward-oriented mesh' }],
  sync: ({ mesh }) => {
    const r = tf.positivelyOriented(mesh as tf.Mesh)
    copyTransform(mesh as tf.Mesh, r)
    return { mesh: r }
  },
  async: async ({ mesh }) => {
    const r = await tf.async.positivelyOriented(mesh as tf.Mesh)
    copyTransform(mesh as tf.Mesh, r)
    return { mesh: r }
  },
})

operators.register({
  id: 'tf.laplacianSmoothed',
  label: 'Laplacian Smooth',
  description: 'Iteratively move vertices toward their neighbors\u2019 centroid. Shrinks the mesh.',
  category: 'geometry',
  tags: ['smooth', 'laplacian', 'denoise'],
  docsUrl: 'https://trueform.polydera.com/ts/modules/geometry#laplacian-smoothing',
  expensive: true,
  inputs: [
    { name: 'mesh', label: 'Mesh', type: 'mesh', description: 'Mesh to smooth' },
    {
      name: 'iterations',
      label: 'Iterations',
      type: 'number',
      description: 'Number of smoothing passes',
      default: 5,
      min: 1,
      max: 500,
      step: 1,
    },
    {
      name: 'lambda',
      label: 'Lambda',
      type: 'number',
      description: 'Movement factor per iteration',
      optional: true,
      default: 0.5,
      min: 0,
      max: 1,
      step: 0.01,
    },
  ],
  outputs: [{ name: 'mesh', label: 'Result', type: 'mesh', description: 'Smoothed mesh' }],
  sync: ({ mesh, iterations, lambda }) => {
    const r = tf.laplacianSmoothed(mesh as tf.Mesh, iterations as number, lambda as number | undefined)
    copyTransform(mesh as tf.Mesh, r)
    return { mesh: r }
  },
  async: async ({ mesh, iterations, lambda }) => {
    const r = await tf.async.laplacianSmoothed(mesh as tf.Mesh, iterations as number, lambda as number | undefined)
    copyTransform(mesh as tf.Mesh, r)
    return { mesh: r }
  },
})

operators.register({
  id: 'tf.taubinSmoothed',
  label: 'Taubin Smooth',
  description: 'Volume-preserving smoothing by alternating shrink and inflate passes.',
  category: 'geometry',
  tags: ['smooth', 'taubin', 'denoise', 'volume-preserving'],
  docsUrl: 'https://trueform.polydera.com/ts/modules/geometry#taubin-smoothing',
  expensive: true,
  inputs: [
    { name: 'mesh', label: 'Mesh', type: 'mesh', description: 'Mesh to smooth' },
    {
      name: 'iterations',
      label: 'Iterations',
      type: 'number',
      description: 'Number of smoothing passes',
      default: 5,
      min: 1,
      max: 500,
      step: 1,
    },
    {
      name: 'lambda',
      label: 'Lambda',
      type: 'number',
      description: 'Shrink factor',
      optional: true,
      default: 0.5,
      min: 0,
      max: 1,
      step: 0.01,
    },
    {
      name: 'kpb',
      label: 'Pass-band',
      type: 'number',
      description: 'Pass-band frequency',
      optional: true,
      default: 0.1,
      min: 0.01,
      max: 1,
      step: 0.01,
    },
  ],
  outputs: [{ name: 'mesh', label: 'Result', type: 'mesh', description: 'Smoothed mesh' }],
  sync: ({ mesh, iterations, lambda, kpb }) => {
    const r = tf.taubinSmoothed(
      mesh as tf.Mesh,
      iterations as number,
      lambda as number | undefined,
      kpb as number | undefined,
    )
    copyTransform(mesh as tf.Mesh, r)
    return { mesh: r }
  },
  async: async ({ mesh, iterations, lambda, kpb }) => {
    const r = await tf.async.taubinSmoothed(
      mesh as tf.Mesh,
      iterations as number,
      lambda as number | undefined,
      kpb as number | undefined,
    )
    copyTransform(mesh as tf.Mesh, r)
    return { mesh: r }
  },
})

operators.register({
  id: 'tf.consistentlyOriented',
  label: 'Orient Consistently',
  description: 'Make face winding consistent within each connected region.',
  category: 'geometry',
  tags: ['orient', 'winding', 'consistent'],
  docsUrl: 'https://trueform.polydera.com/ts/modules/topology#face-orientation',
  inputs: [{ name: 'mesh', label: 'Mesh', type: 'mesh', description: 'Mesh to orient' }],
  outputs: [{ name: 'mesh', label: 'Result', type: 'mesh', description: 'Consistently oriented mesh' }],
  sync: ({ mesh }) => {
    const r = tf.consistentlyOriented(mesh as tf.Mesh)
    copyTransform(mesh as tf.Mesh, r)
    return { mesh: r }
  },
  async: async ({ mesh }) => {
    const r = await tf.async.consistentlyOriented(mesh as tf.Mesh)
    copyTransform(mesh as tf.Mesh, r)
    return { mesh: r }
  },
})

operators.register({
  id: 'tf.reverseWinding',
  label: 'Reverse Winding',
  description: 'Flip face winding order (reverse normals).',
  category: 'geometry',
  tags: ['reverse', 'flip', 'winding', 'normals'],
  docsUrl: 'https://trueform.polydera.com/ts/modules/topology#face-orientation',
  inputs: [{ name: 'mesh', label: 'Mesh', type: 'mesh', description: 'Mesh to flip' }],
  outputs: [{ name: 'mesh', label: 'Result', type: 'mesh', description: 'Mesh with reversed winding' }],
  sync: ({ mesh }) => {
    const r = tf.reverseWinding(mesh as tf.Mesh)
    copyTransform(mesh as tf.Mesh, r)
    return { mesh: r }
  },
  async: async ({ mesh }) => {
    const r = await tf.async.reverseWinding(mesh as tf.Mesh)
    copyTransform(mesh as tf.Mesh, r)
    return { mesh: r }
  },
})
