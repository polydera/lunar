import { operators, sceneOperators } from '@/core'
import type { Operator, SceneOperator } from '@/core'

export type CategoryItem =
  | { type: 'action'; id: string; label: string; icon?: string; description?: string; docsUrl?: string }
  | { type: 'operator'; operator: Operator }
  | { type: 'sceneOperator'; sceneOperator: SceneOperator }

export interface Category {
  id: string
  label: string
  icon: string
  minSelection: number
  maxSelection?: number
  items: CategoryItem[]
}

export function buildCategories(): Category[] {
  return [
    {
      id: 'io',
      label: 'IO',
      icon: 'i-lucide:file',
      minSelection: 0,
      items: [
        {
          type: 'action',
          id: 'io-open',
          label: 'Import',
          icon: 'i-lucide:file-up',
          description: 'Load STL or OBJ meshes from disk',
          docsUrl: 'https://trueform.polydera.com/ts/modules/io#stl-files',
        },
        {
          type: 'action',
          id: 'io-export-stl',
          label: 'Export STL',
          icon: 'i-lucide:file-down',
          description: 'Save the selected mesh to a binary STL file',
          docsUrl: 'https://trueform.polydera.com/ts/modules/io#stl-files',
        },
        {
          type: 'action',
          id: 'io-export-obj',
          label: 'Export OBJ',
          icon: 'i-lucide:file-down',
          description: 'Save the selected mesh to a Wavefront OBJ file',
          docsUrl: 'https://trueform.polydera.com/ts/modules/io#obj-files',
        },
        {
          type: 'action',
          id: 'io-download',
          label: 'Download',
          icon: 'i-lucide:download',
          description: 'Download and showcase a famous mesh',
        },
      ],
    },
    {
      id: 'add',
      label: 'Add',
      icon: 'i-lucide:plus',
      minSelection: 0,
      items: [
        { type: 'operator', operator: operators.get('tf.sphereMesh')! },
        { type: 'operator', operator: operators.get('tf.boxMesh')! },
        { type: 'operator', operator: operators.get('tf.cylinderMesh')! },
        { type: 'operator', operator: operators.get('tf.planeMesh')! },
      ],
    },
    {
      id: 'inspect',
      label: 'Inspect',
      icon: 'i-lucide:search',
      minSelection: 1,
      items: [
        {
          type: 'action',
          id: 'tf.analysis',
          label: 'Analysis',
          icon: 'i-lucide:file-text',
          description: 'Full mesh analysis',
        },
        { type: 'operator', operator: operators.get('tf.boundaryEdges')! },
        { type: 'operator', operator: operators.get('tf.nonManifoldEdges')! },
        { type: 'operator', operator: operators.get('tf.sharpEdges')! },
        { type: 'operator', operator: operators.get('tf.connectedComponents')! },
        { type: 'operator', operator: operators.get('tf.selfIntersectionCurves')! },
      ],
    },
    {
      id: 'fields',
      label: 'Fields',
      icon: 'i-lucide:activity',
      minSelection: 1,
      items: [
        { type: 'operator', operator: operators.get('tf.curvature')! },
        { type: 'operator', operator: operators.get('tf.normals')! },
        { type: 'operator', operator: operators.get('tf.distanceField')! },
      ],
    },
    {
      id: 'curves',
      label: 'Curves',
      icon: 'i-lucide:spline',
      minSelection: 1,
      items: [
        { type: 'operator', operator: operators.get('tf.isocontours')! },
        { type: 'operator', operator: operators.get('tf.triangulateCurves')! },
      ],
    },
    {
      id: 'repair',
      label: 'Repair',
      icon: 'i-lucide:wrench',
      minSelection: 1,
      items: [
        { type: 'operator', operator: operators.get('tf.cleaned')! },
        { type: 'operator', operator: operators.get('tf.positivelyOriented')! },
        { type: 'operator', operator: operators.get('tf.consistentlyOriented')! },
        { type: 'operator', operator: operators.get('tf.reverseWinding')! },
      ],
    },
    {
      id: 'refine',
      label: 'Refine',
      icon: 'i-lucide:scaling',
      minSelection: 1,
      items: [
        { type: 'operator', operator: operators.get('tf.decimated')! },
        { type: 'operator', operator: operators.get('tf.isotropicRemeshed')! },
        { type: 'operator', operator: operators.get('tf.laplacianSmoothed')! },
        { type: 'operator', operator: operators.get('tf.taubinSmoothed')! },
      ],
    },
    {
      id: 'cut',
      label: 'Cut',
      icon: 'i-lucide:scissors',
      minSelection: 1,
      items: [
        { type: 'operator', operator: operators.get('tf.boolean')! },
        { type: 'operator', operator: operators.get('tf.embeddedIntersectionCurves')! },
        { type: 'operator', operator: operators.get('tf.embeddedSelfIntersectionCurves')! },
        { type: 'operator', operator: operators.get('tf.meshArrangements')! },
        { type: 'operator', operator: operators.get('tf.polygonArrangements')! },
      ],
    },
    {
      id: 'reindex',
      label: 'Reindex',
      icon: 'i-lucide:split',
      minSelection: 1,
      items: [
        { type: 'operator', operator: operators.get('tf.concatenateMeshes')! },
        { type: 'operator', operator: operators.get('tf.splitIntoComponents')! },
      ],
    },
    {
      id: 'align',
      label: 'Align',
      icon: 'i-lucide:move-3d',
      minSelection: 1,
      items: [
        { type: 'operator', operator: operators.get('tf.alignMeshes')! },
        { type: 'operator', operator: operators.get('tf.alignToFrame')! },
      ],
    },
    {
      id: 'style',
      label: 'Style',
      icon: 'i-lucide:palette',
      minSelection: 1,
      items: [
        { type: 'sceneOperator', sceneOperator: sceneOperators.get('style.colorByArray')! },
        { type: 'sceneOperator', sceneOperator: sceneOperators.get('style.shading')! },
      ],
    },
  ]
}
