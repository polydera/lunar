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

operators.register({
  id: 'tf.splitIntoDomains',
  label: 'Split Domains',
  description:
    'Decompose a non-manifold surface mesh (typically the output of Mesh Arrangements) into per-domain watertight outward-oriented submeshes. Runs clean → domainLabels → splitIntoDomains.',
  category: 'reindex',
  tags: ['split', 'domains', 'arrangement', 'decompose', 'watertight', 'volumetric'],
  docsUrl: 'https://trueform.polydera.com/ts/modules/reindex#split-into-domains',
  expensive: true,
  inputs: [
    {
      name: 'mesh',
      label: 'Mesh',
      type: 'mesh',
      description:
        'Non-manifold surface mesh bounding multiple 3D regions. Typically the result of tf.meshArrangements; self-intersections must already be resolved (clean alone does not).',
    },
    {
      name: 'precision',
      label: 'Precision',
      type: 'number',
      description: 'Number of decimal places for dedup tolerance during clean (0 = exact match)',
      optional: true,
      default: 6,
      min: 0,
      max: 10,
      step: 1,
    },
    {
      name: 'ignoreOpenFragments',
      label: 'Ignore Open Fragments',
      type: 'boolean',
      description: 'Drop face-sides bounding open fragments (faces in components carrying boundary edges)',
      optional: true,
      default: true,
    },
    {
      name: 'excludeOuterShell',
      label: 'Exclude Outer Shell',
      type: 'boolean',
      description: 'Drop the unbounded universe domain so only bounded interior domains are returned',
      optional: true,
      default: true,
    },
  ],
  outputs: [
    { name: 'components', label: 'Domain', type: 'mesh', description: 'Per-domain watertight submeshes', array: true },
    { name: 'labels', label: 'Labels', type: 'ndarray', description: 'Domain label value for each component' },
  ],
  sync: ({ mesh, precision, ignoreOpenFragments, excludeOuterShell }) => {
    const input = mesh as tf.Mesh
    const tol = (precision as number) > 0 ? Math.pow(10, -(precision as number)) : undefined
    const cleaned = tf.cleaned(input, tol)
    const dl = tf.domainLabels(cleaned, {
      ignoreOpenFragments: ignoreOpenFragments as boolean,
      excludeOuterShell: excludeOuterShell as boolean,
    })
    const result = tf.splitIntoDomains(cleaned, dl)
    dl.labels.delete()
    cleaned.delete()
    for (const comp of result.components) copyTransform(input, comp)
    return result as unknown as Record<string, unknown>
  },
  async: async ({ mesh, precision, ignoreOpenFragments, excludeOuterShell }) => {
    const input = mesh as tf.Mesh
    const tol = (precision as number) > 0 ? Math.pow(10, -(precision as number)) : undefined
    const cleaned = await tf.async.cleaned(input, tol)
    const dl = await tf.async.domainLabels(cleaned, {
      ignoreOpenFragments: ignoreOpenFragments as boolean,
      excludeOuterShell: excludeOuterShell as boolean,
    })
    const result = await tf.async.splitIntoDomains(cleaned, dl)
    dl.labels.delete()
    cleaned.delete()
    for (const comp of result.components) copyTransform(input, comp)
    return result as unknown as Record<string, unknown>
  },
})
