import * as tf from '@polydera/trueform'
import { operators } from '../registry'
import { copyTransform } from '../utils'

operators.register({
  id: 'tf.cleaned',
  label: 'Clean Mesh',
  description: 'Remove duplicate vertices, duplicate faces, degenerate faces, and unreferenced vertices.',
  category: 'clean',
  tags: ['clean', 'dedup', 'fix', 'repair'],
  docsUrl: 'https://trueform.polydera.com/ts/modules/clean#meshes',
  inputs: [
    { name: 'mesh', label: 'Mesh', type: 'mesh', description: 'Mesh to clean' },
    {
      name: 'precision',
      label: 'Precision',
      type: 'number',
      description: 'Number of decimal places for duplicate detection (0 = exact match)',
      optional: true,
      default: 0,
      min: 0,
      max: 10,
      step: 1,
    },
  ],
  outputs: [{ name: 'mesh', label: 'Result', type: 'mesh', description: 'Cleaned mesh' }],
  sync: ({ mesh, precision }) => {
    const tol = (precision as number) > 0 ? Math.pow(10, -(precision as number)) : undefined
    const r = tf.cleaned(mesh as tf.Mesh, tol)
    copyTransform(mesh as tf.Mesh, r)
    return { mesh: r }
  },
  async: async ({ mesh, precision }) => {
    const tol = (precision as number) > 0 ? Math.pow(10, -(precision as number)) : undefined
    const r = await tf.async.cleaned(mesh as tf.Mesh, tol)
    copyTransform(mesh as tf.Mesh, r)
    return { mesh: r }
  },
})
