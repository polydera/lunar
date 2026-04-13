import * as tf from '@polydera/trueform'
import { operators } from '../registry'
import { registerUIInputHandler } from '@/ui/inputHandlers'

// ── Isocontours ──────────────────────────────────────────────────────────────
//
// Extract contour curves on a mesh surface where a scalar field crosses
// threshold values. The operator takes an array of thresholds (cutValues) —
// trueform's native signature. The UI surface is a three-slider sugar
// (start/end/count) that produces an evenly-spaced linspace; the mapping
// lives in a UIInputHandler below so the schema stays honest for MCP.

operators.register({
  id: 'tf.isocontours',
  label: 'Isocontours',
  description: 'Extract contour curves at scalar field threshold values.',
  category: 'curves',
  outputAsChild: true,
  expensive: true,
  tags: ['isocontours', 'contours', 'level', 'scalar', 'field'],
  docsUrl: 'https://trueform.polydera.com/ts/modules/intersect#isocontours',
  inputs: [
    {
      name: 'mesh',
      label: 'Mesh',
      type: 'mesh',
      description: 'Mesh to contour',
      childInput: {
        name: 'scalars',
        label: 'Scalar Field',
        type: 'ndarray',
        description: 'Per-vertex scalar values',
        filter: (child, parent) => (child as tf.NDArray).shape[0] === (parent as tf.Mesh).numberOfPoints,
      },
    },
    {
      name: 'cutValues',
      label: 'Thresholds',
      type: 'number',
      array: true,
      description: 'Threshold values where contour curves are extracted',
    },
  ],
  outputs: [{ name: 'curves', label: 'Contours', type: 'curves', description: 'Contour curves' }],
  sync: ({ mesh, scalars, cutValues }) => {
    const vals = new Float32Array(cutValues as number[])
    const curves = tf.isocontours(mesh as tf.Mesh, scalars as tf.NDArrayFloat32, vals)
    return { curves }
  },
  async: async ({ mesh, scalars, cutValues }) => {
    const vals = new Float32Array(cutValues as number[])
    const curves = await tf.async.isocontours(mesh as tf.Mesh, scalars as tf.NDArrayFloat32, vals)
    return { curves }
  },
})

registerUIInputHandler('tf.isocontours', 'cutValues', {
  inputs: (ctx) => {
    const stats = ctx?.properties[ctx.operandIds.scalars ?? '']
    const mn = (stats?.min as number | undefined) ?? 0
    const mx = (stats?.max as number | undefined) ?? 1
    const step = (mx - mn) / 100 || 0.01
    return [
      {
        name: 'start',
        label: 'Start',
        type: 'number',
        description: 'Lowest threshold',
        min: mn,
        max: mx,
        step,
        default: mn,
      },
      {
        name: 'end',
        label: 'End',
        type: 'number',
        description: 'Highest threshold',
        min: mx,
        max: mn,
        step: -step,
        default: mx,
      },
      {
        name: 'count',
        label: 'Count',
        type: 'number',
        description: 'Number of contour levels',
        min: 1,
        max: 100,
        step: 1,
        default: 1,
      },
    ]
  },
  combine: ({ start, end, count }) => {
    const n = count as number
    if (n < 1) return []
    const vals = tf.linspace(start as number, end as number, n)
    const arr = Array.from(vals.data as Float32Array)
    vals.delete()
    return arr
  },
})

// ── Triangulate Curves ───────────────────────────────────────────────────────

operators.register({
  id: 'tf.triangulateCurves',
  label: 'Triangulate',
  description: 'Triangulate closed curve loops into a mesh (e.g. cross-section caps).',
  category: 'curves',
  tags: ['triangulate', 'curves', 'cap', 'cross-section', 'fill'],
  docsUrl: 'https://trueform.polydera.com/ts/modules/geometry#triangulate',
  inputs: [{ name: 'curves', label: 'Curves', type: 'curves', description: 'Closed curve loops to triangulate' }],
  outputs: [{ name: 'mesh', label: 'Mesh', type: 'mesh', description: 'Triangulated mesh' }],
  sync: ({ curves }) => {
    const c = curves as tf.Curves
    const points = c.points
    const mesh = tf.triangulate({ faces: c.paths, points })
    points.delete()
    return { mesh }
  },
  async: async ({ curves }) => {
    const c = curves as tf.Curves
    const points = c.points
    const mesh = await tf.async.triangulate({ faces: c.paths, points })
    points.delete()
    return { mesh }
  },
})
