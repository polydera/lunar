import * as tf from '@polydera/trueform'
import { operators } from '../registry'
import { copyTransform } from '../utils'

operators.register({
  id: 'tf.concatenateMeshes',
  label: 'Concatenate',
  description: 'Merge multiple meshes into one. Applies transformations and offsets face indices.',
  category: 'reindex',
  tags: ['merge', 'combine', 'concatenate', 'join'],
  docsUrl: 'https://trueform.polydera.com/ts/modules/reindex#concatenation',
  inputs: [{ name: 'meshes', label: 'Meshes', type: 'mesh', description: 'Meshes to merge', array: true }],
  outputs: [{ name: 'mesh', label: 'Result', type: 'mesh', description: 'Merged mesh' }],
  sync: ({ meshes }) => ({ mesh: tf.concatenateMeshes(meshes as unknown as tf.Mesh[]) }),
  async: async ({ meshes }) => ({ mesh: await tf.async.concatenateMeshes(meshes as unknown as tf.Mesh[]) }),
})

operators.register({
  id: 'tf.splitIntoComponents',
  label: 'Split Components',
  description: 'Split a mesh into separate meshes by per-face labels.',
  category: 'reindex',
  tags: ['split', 'components', 'separate'],
  docsUrl: 'https://trueform.polydera.com/ts/modules/reindex#split-into-components',
  inputs: [
    {
      name: 'mesh',
      label: 'Mesh',
      type: 'mesh',
      description: 'Mesh to split',
      childInput: { name: 'labels', label: 'Labels', type: 'ndarray', description: 'Per-face label array' },
    },
  ],
  outputs: [
    { name: 'components', label: 'Component', type: 'mesh', description: 'Component meshes', array: true },
    { name: 'labels', label: 'Labels', type: 'ndarray', description: 'Label values for each component' },
  ],
  sync: ({ mesh, labels }) => {
    const input = mesh as tf.Mesh
    const result = tf.splitIntoComponents(input, labels as tf.NDArrayInt32)
    for (const comp of result.components) copyTransform(input, comp)
    return result as unknown as Record<string, unknown>
  },
  async: async ({ mesh, labels }) => {
    const input = mesh as tf.Mesh
    const result = await tf.async.splitIntoComponents(input, labels as tf.NDArrayInt32)
    for (const comp of result.components) copyTransform(input, comp)
    return result as unknown as Record<string, unknown>
  },
})
