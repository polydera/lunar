import * as tf from '@polydera/trueform'
import { operators } from '../registry'

// ── Curvature ─────────────────────────────────────────────────────────────────

type CurvatureVariant = 'mean' | 'gaussian' | 'minMax' | 'shapeIndex'

const curvatureLabels: Record<CurvatureVariant, string | string[]> = {
  mean: 'Mean Curvature',
  gaussian: 'Gaussian Curvature',
  shapeIndex: 'Shape Index',
  minMax: ['Max Curvature', 'Min Curvature'],
}

function curvatureFromPrincipal(
  k0: tf.NDArrayFloat32,
  k1: tf.NDArrayFloat32,
  variant: CurvatureVariant,
): tf.NDArrayFloat32[] {
  switch (variant) {
    case 'minMax':
      return [k0.clone(), k1.clone()]
    case 'gaussian':
      return [k0.mul(k1) as tf.NDArrayFloat32]
    case 'mean':
    default: {
      const sum = k0.add(k1) as tf.NDArrayFloat32
      const mean = sum.mul(0.5) as tf.NDArrayFloat32
      sum.delete()
      return [mean]
    }
  }
}

operators.register({
  id: 'tf.curvature',
  label: 'Curvature',
  description: 'Compute per-vertex curvature from principal curvatures or shape index.',
  category: 'fields',
  outputAsChild: true,
  tags: ['curvature', 'gaussian', 'mean', 'principal', 'shape'],
  docsUrl: 'https://trueform.polydera.com/ts/modules/geometry#principal-curvatures',
  inputs: [
    { name: 'mesh', label: 'Mesh', type: 'mesh', description: 'Mesh to analyze' },
    {
      name: 'variant',
      label: 'Variant',
      type: 'string',
      description: 'Which curvature to compute',
      enum: ['mean', 'gaussian', 'minMax', 'shapeIndex'],
      default: 'mean',
    },
    {
      name: 'k',
      label: 'Neighborhood',
      type: 'number',
      description: 'Smoothing neighborhood size (ring count)',
      default: 2,
      min: 2,
      max: 10,
      step: 1,
    },
  ],
  outputs: [
    {
      name: 'curvature',
      label: 'Curvature',
      type: 'ndarray',
      description: 'Per-vertex curvature values',
      array: true,
    },
  ],
  sync: ({ mesh, variant, k }) => {
    const m = mesh as tf.Mesh
    const v = variant as CurvatureVariant
    const kn = k as number
    const __labels = { curvature: curvatureLabels[v] }
    if (v === 'shapeIndex') {
      return { curvature: [tf.shapeIndex(m, kn)], __labels } as unknown as Record<string, unknown>
    }
    const { k0, k1 } = tf.principalCurvatures(m, kn)
    const out = curvatureFromPrincipal(k0, k1, v)
    k0.delete()
    k1.delete()
    return { curvature: out, __labels } as unknown as Record<string, unknown>
  },
  async: async ({ mesh, variant, k }) => {
    const m = mesh as tf.Mesh
    const v = variant as CurvatureVariant
    const kn = k as number
    const __labels = { curvature: curvatureLabels[v] }
    if (v === 'shapeIndex') {
      return { curvature: [await tf.async.shapeIndex(m, kn)], __labels } as unknown as Record<string, unknown>
    }
    const { k0, k1 } = await tf.async.principalCurvatures(m, kn)
    const out = curvatureFromPrincipal(k0, k1, v)
    k0.delete()
    k1.delete()
    return { curvature: out, __labels } as unknown as Record<string, unknown>
  },
})

// ── Normals ───────────────────────────────────────────────────────────────────

type NormalsVariant = 'point' | 'face'

const normalsLabels: Record<NormalsVariant, string> = {
  point: 'Point Normals',
  face: 'Face Normals',
}

operators.register({
  id: 'tf.normals',
  label: 'Normals',
  description: 'Compute per-vertex or per-face normal vectors.',
  category: 'fields',
  outputAsChild: true,
  tags: ['normals', 'point', 'face', 'vertex'],
  docsUrl: 'https://trueform.polydera.com/ts/modules/geometry#normals',
  inputs: [
    { name: 'mesh', label: 'Mesh', type: 'mesh', description: 'Mesh to compute normals for' },
    {
      name: 'variant',
      label: 'Variant',
      type: 'string',
      description: 'Per-vertex or per-face normals',
      enum: ['point', 'face'],
      default: 'point',
    },
  ],
  outputs: [
    {
      name: 'normals',
      label: 'Normals',
      type: 'ndarray',
      description: 'Normal vectors [N, 3]',
    },
  ],
  sync: ({ mesh, variant }) => {
    const m = mesh as tf.Mesh
    const v = variant as NormalsVariant
    const __labels = { normals: normalsLabels[v] }
    const normals = v === 'point' ? m.pointNormals : m.normals
    return { normals, __labels }
  },
  async: async ({ mesh, variant }) => {
    const m = mesh as tf.Mesh
    const v = variant as NormalsVariant
    const __labels = { normals: normalsLabels[v] }
    const normals = v === 'point' ? await tf.async.computePointNormals(m) : await tf.async.computeNormals(m)
    return { normals, __labels }
  },
})

// ── Distance Field ────────────────────────────────────────────────────────────

operators.register({
  id: 'tf.distanceField',
  label: 'Distance Field',
  description: 'Per-vertex distance from the source mesh to the target mesh.',
  category: 'fields',
  outputAsChild: true,
  expensive: true,
  tags: ['distance', 'field', 'proximity', 'spatial'],
  docsUrl: 'https://trueform.polydera.com/ts/modules/spatial#distance',
  inputs: [
    { name: 'source', label: 'Source', type: 'mesh', description: 'Mesh whose vertices are queried' },
    { name: 'target', label: 'Target', type: 'mesh', description: 'Mesh to measure distance to' },
  ],
  outputs: [
    {
      name: 'distances',
      label: 'Distance',
      type: 'ndarray',
      description: 'Per-vertex distance from source to target',
    },
  ],
  sync: ({ source, target }) => {
    const src = source as tf.Mesh
    const tgt = target as tf.Mesh
    tgt.buildTree() // idempotent — no-op if tree already built
    const pts = src.points
    const p = tf.point(pts)
    // distance(Form, Primitive) returns one distance per batch point.
    const distances = tf.distance(tgt, p) as tf.NDArrayFloat32
    p.delete()
    pts.delete()
    return { distances, __labels: { distances: 'Distance' } }
  },
  async: async ({ source, target }) => {
    const src = source as tf.Mesh
    const tgt = target as tf.Mesh
    await tf.async.buildTree(tgt)
    const pts = src.points
    const p = tf.point(pts)
    const distances = (await tf.async.distance(tgt, p)) as tf.NDArrayFloat32
    p.delete()
    pts.delete()
    return { distances, __labels: { distances: 'Distance' } }
  },
})
