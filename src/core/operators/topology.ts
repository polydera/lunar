import * as tf from '@polydera/trueform'
import { operators } from '../registry'

operators.register({
  id: 'tf.isClosed',
  label: 'Is Closed',
  description: 'Check if a mesh is watertight (no boundary edges).',
  category: 'topology',
  tags: ['closed', 'watertight', 'boundary'],
  docsUrl: 'https://trueform.polydera.com/ts/modules/topology#closed--open',
  inputs: [{ name: 'mesh', label: 'Mesh', type: 'mesh', description: 'Mesh to check' }],
  outputs: [{ name: 'result', label: 'Result', type: 'boolean', description: 'True if no boundary edges' }],
  sync: ({ mesh }) => ({ result: tf.isClosed(mesh as tf.Mesh) }),
  async: async ({ mesh }) => ({ result: await tf.async.isClosed(mesh as tf.Mesh) }),
})

operators.register({
  id: 'tf.isManifold',
  label: 'Is Manifold',
  description: 'Check if every edge is shared by at most 2 faces.',
  category: 'topology',
  tags: ['manifold', 'quality'],
  docsUrl: 'https://trueform.polydera.com/ts/modules/topology#manifold',
  inputs: [{ name: 'mesh', label: 'Mesh', type: 'mesh', description: 'Mesh to check' }],
  outputs: [{ name: 'result', label: 'Result', type: 'boolean', description: 'True if manifold' }],
  sync: ({ mesh }) => ({ result: tf.isManifold(mesh as tf.Mesh) }),
  async: async ({ mesh }) => ({ result: await tf.async.isManifold(mesh as tf.Mesh) }),
})
