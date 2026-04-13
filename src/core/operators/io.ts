import * as tf from '@polydera/trueform'
import { operators } from '../registry'

operators.register({
  id: 'tf.readStl',
  label: 'Read STL',
  description: 'Load a triangle mesh from an STL file (binary or ASCII).',
  category: 'io',
  tags: ['import', 'load', 'file', 'stl'],
  docsUrl: 'https://trueform.polydera.com/ts/modules/io#stl-files',
  inputs: [{ name: 'data', label: 'File Data', type: 'ndarray', description: 'File contents as ArrayBuffer or Uint8Array' }],
  outputs: [{ name: 'mesh', label: 'Mesh', type: 'mesh', description: 'Loaded triangle mesh' }],
  sync: ({ data }) => ({ mesh: tf.readStl(data as ArrayBuffer) }),
  async: async ({ data }) => ({ mesh: await tf.async.readStl(data as ArrayBuffer) }),
})

operators.register({
  id: 'tf.readObj',
  label: 'Read OBJ',
  description: 'Load a triangle mesh from an OBJ file. Supports triangles and polygons (auto-triangulated).',
  category: 'io',
  tags: ['import', 'load', 'file', 'obj'],
  docsUrl: 'https://trueform.polydera.com/ts/modules/io#obj-files',
  inputs: [
    { name: 'data', label: 'File Data', type: 'ndarray', description: 'File contents as ArrayBuffer or Uint8Array' },
    {
      name: 'dynamic',
      label: 'Dynamic',
      type: 'boolean',
      description: 'Read all polygon sizes and auto-triangulate',
      optional: true,
      default: false,
    },
  ],
  outputs: [{ name: 'mesh', label: 'Mesh', type: 'mesh', description: 'Loaded triangle mesh' }],
  sync: ({ data, dynamic }) => ({ mesh: tf.readObj(data as ArrayBuffer, dynamic ? { dynamic: true } : undefined) }),
  async: async ({ data, dynamic }) => ({
    mesh: await tf.async.readObj(data as ArrayBuffer, dynamic ? { dynamic: true } : undefined),
  }),
})

operators.register({
  id: 'tf.writeStl',
  label: 'Write STL',
  description: 'Export a mesh to binary STL format. Applies mesh transformation to vertex positions.',
  category: 'io',
  tags: ['export', 'save', 'file', 'stl'],
  docsUrl: 'https://trueform.polydera.com/ts/modules/io#stl-files',
  inputs: [{ name: 'mesh', label: 'Mesh', type: 'mesh', description: 'Mesh to export' }],
  outputs: [{ name: 'data', label: 'File Data', type: 'ndarray', description: 'Binary STL data' }],
  sync: ({ mesh }) => ({ data: tf.writeStl(mesh as tf.Mesh) }),
  async: async ({ mesh }) => ({ data: await tf.async.writeStl(mesh as tf.Mesh) }),
})

operators.register({
  id: 'tf.writeObj',
  label: 'Write OBJ',
  description: 'Export a mesh to ASCII OBJ format. Includes vertex positions and face connectivity only.',
  category: 'io',
  tags: ['export', 'save', 'file', 'obj'],
  docsUrl: 'https://trueform.polydera.com/ts/modules/io#obj-files',
  inputs: [{ name: 'mesh', label: 'Mesh', type: 'mesh', description: 'Mesh to export' }],
  outputs: [{ name: 'data', label: 'File Data', type: 'ndarray', description: 'ASCII OBJ data' }],
  sync: ({ mesh }) => ({ data: tf.writeObj(mesh as tf.Mesh) }),
  async: async ({ mesh }) => ({ data: await tf.async.writeObj(mesh as tf.Mesh) }),
})
