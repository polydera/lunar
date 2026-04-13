import * as tf from '@polydera/trueform'
import { operators } from '../registry'

function edgesToCurves(mesh: tf.Mesh, edges: tf.NDArrayInt32): { curves: tf.Curves; edgeCount: number } {
  const edgeCount = edges.shape[0]!
  const paths = tf.connectEdgesToPaths(edges)

  const pts = mesh.points
  const curves = tf.curves(paths, pts)
  pts.delete()
  paths.delete()
  return { curves, edgeCount }
}

operators.register({
  id: 'tf.boundaryEdges',
  label: 'Boundary Edges',
  description: 'Find edges that belong to only one face (mesh boundary).',
  category: 'inspect',
  outputAsChild: true,
  tags: ['boundary', 'edges', 'open'],
  docsUrl: 'https://trueform.polydera.com/ts/modules/topology#boundary-edges',
  inputs: [{ name: 'mesh', label: 'Mesh', type: 'mesh', description: 'Mesh to inspect' }],
  outputs: [
    { name: 'curves', label: 'Curves', type: 'curves', description: 'Boundary edge curves' },
    { name: 'edgeCount', label: 'Edges', type: 'number', description: 'Number of boundary edges' },
  ],
  sync: ({ mesh }) => {
    const edges = tf.boundaryEdges(mesh as tf.Mesh)
    const result = edgesToCurves(mesh as tf.Mesh, edges)
    edges.delete()
    return result
  },
  async: async ({ mesh }) => {
    const edges = await tf.async.boundaryEdges(mesh as tf.Mesh)
    const result = edgesToCurves(mesh as tf.Mesh, edges)
    edges.delete()
    return result
  },
})

operators.register({
  id: 'tf.nonManifoldEdges',
  label: 'Non-Manifold Edges',
  description: 'Find edges shared by more than 2 faces.',
  category: 'inspect',
  outputAsChild: true,
  tags: ['non-manifold', 'edges', 'quality'],
  docsUrl: 'https://trueform.polydera.com/ts/modules/topology#non-manifold-edges',
  inputs: [{ name: 'mesh', label: 'Mesh', type: 'mesh', description: 'Mesh to inspect' }],
  outputs: [
    { name: 'curves', label: 'Curves', type: 'curves', description: 'Non-manifold edge curves' },
    { name: 'edgeCount', label: 'Edges', type: 'number', description: 'Number of non-manifold edges' },
  ],
  sync: ({ mesh }) => {
    const edges = tf.nonManifoldEdges(mesh as tf.Mesh)
    const result = edgesToCurves(mesh as tf.Mesh, edges)
    edges.delete()
    return result
  },
  async: async ({ mesh }) => {
    const edges = await tf.async.nonManifoldEdges(mesh as tf.Mesh)
    const result = edgesToCurves(mesh as tf.Mesh, edges)
    edges.delete()
    return result
  },
})

operators.register({
  id: 'tf.sharpEdges',
  label: 'Sharp Edges',
  description: 'Find edges where the dihedral angle exceeds a threshold.',
  category: 'inspect',
  outputAsChild: true,
  tags: ['sharp', 'feature', 'edges', 'crease'],
  docsUrl: 'https://trueform.polydera.com/ts/modules/geometry#sharp-edges',
  inputs: [
    { name: 'mesh', label: 'Mesh', type: 'mesh', description: 'Mesh to inspect' },
    {
      name: 'angle',
      label: 'Angle',
      type: 'number',
      description: 'Angle threshold in degrees',
      default: 30,
      min: 0,
      max: 180,
      step: 1,
    },
  ],
  outputs: [
    { name: 'curves', label: 'Curves', type: 'curves', description: 'Sharp edge curves' },
    { name: 'edgeCount', label: 'Edges', type: 'number', description: 'Number of sharp edges' },
  ],
  sync: ({ mesh, angle }) => {
    const edges = tf.sharpEdges(mesh as tf.Mesh, angle as number)
    const result = edgesToCurves(mesh as tf.Mesh, edges)
    edges.delete()
    return result
  },
  async: async ({ mesh, angle }) => {
    const edges = await tf.async.sharpEdges(mesh as tf.Mesh, angle as number)
    const result = edgesToCurves(mesh as tf.Mesh, edges)
    edges.delete()
    return result
  },
})

operators.register({
  id: 'tf.connectedComponents',
  label: 'Connected Components',
  description: 'Label connected components of a mesh.',
  category: 'inspect',
  outputAsChild: true,
  tags: ['components', 'connected', 'label'],
  docsUrl: 'https://trueform.polydera.com/ts/modules/topology#from-mesh',
  inputs: [
    { name: 'mesh', label: 'Mesh', type: 'mesh', description: 'Mesh to analyze' },
    {
      name: 'type',
      label: 'Connectivity',
      type: 'string',
      description: 'Connectivity mode',
      enum: ['edge', 'manifoldEdge', 'vertex'],
      default: 'edge',
    },
  ],
  outputs: [
    { name: 'labels', label: 'Labels', type: 'ndarray', description: 'Per-face component ID' },
    { name: 'nComponents', label: 'Count', type: 'number', description: 'Number of components' },
  ],
  sync: ({ mesh, type }) => {
    const t = type as string
    const __labels = { labels: `Components (${t})` }
    return {
      ...(tf.connectedComponents(mesh as tf.Mesh, t as tf.ComponentType) as unknown as Record<string, unknown>),
      __labels,
    }
  },
  async: async ({ mesh, type }) => {
    const t = type as string
    const __labels = { labels: `Components (${t})` }
    return {
      ...((await tf.async.connectedComponents(mesh as tf.Mesh, t as tf.ComponentType)) as unknown as Record<
        string,
        unknown
      >),
      __labels,
    }
  },
})
