import * as tf from '@polydera/trueform'
import { operands } from '@/core'
import { prefs } from '@/composables/usePreferences'
import { generateReport } from '@/composables/useReport'
import type { ActionRegistrar } from '../types'

export function registerGeometryActions({ register, ctx, sanitizeProperties }: ActionRegistrar) {
  function returnCreated(id: string, label: string, type: string) {
    const properties = ctx.scene.getProperties(id)
    return {
      created: [{ id, label, type, properties: properties ? sanitizeProperties(properties) : undefined }],
      totalNodes: ctx.scene.nodes.size,
    }
  }

  function setRawTransform(data: unknown, transform?: unknown) {
    if (!transform) return
    const arr = transform as number[]
    if (arr.length !== 16) throw new Error('transform must be 16 numbers')
    const m = tf.ndarray(new Float32Array(arr)).reshape([4, 4])
    ;(data as any).transformation = m
    m.delete()
  }

  register({
    id: 'scene.add_mesh',
    label: 'Add Mesh',
    description: 'Add a mesh from raw vertex and face data',
    category: 'scene',
    inputs: [
      { name: 'label', label: 'Label', type: 'string', description: 'Display name' },
      { name: 'points', label: 'Points', type: 'array', description: 'Flat [x,y,z,...] vertex coordinates' },
      { name: 'faces', label: 'Faces', type: 'array', description: 'Flat [i,j,k,...] triangle indices' },
      { name: 'transform', label: 'Transform', type: 'array', description: '16 floats, row-major 4x4 (optional)' },
      { name: 'parentId', label: 'Parent', type: 'string', description: 'Parent node ID (optional)' },
      { name: 'color', label: 'Color', type: 'string', description: 'Hex color (optional)' },
    ],
    execute: (_, p) => {
      const label = p.label as string
      const points = p.points as number[]
      const faces = p.faces as number[]
      if (points.length % 3 !== 0) throw new Error('points length must be divisible by 3')
      if (faces.length % 3 !== 0) throw new Error('faces length must be divisible by 3')
      const parentId = (p.parentId as string | undefined) ?? null
      if (parentId && !ctx.scene.getNode(parentId)) throw new Error(`Parent node not found: ${parentId}`)
      const mesh = tf.mesh(new Int32Array(faces), new Float32Array(points))
      setRawTransform(mesh, p.transform)
      const id = operands.nextId('mesh')
      operands.add({ id, type: 'mesh', data: mesh })
      const color = (p.color as string | undefined) ?? prefs.defaultObjectColor
      ctx.scene.addNode({
        id,
        label,
        parentId,
        order: 0,
        operandId: id,
        visible: true,
        color,
        opacity: 100,
        renderMode: 'solid',
      })
      return returnCreated(id, label, 'mesh')
    },
  })

  register({
    id: 'scene.add_curves',
    label: 'Add Curves',
    description: 'Add curves from raw vertex, path, and offset data',
    category: 'scene',
    inputs: [
      { name: 'label', label: 'Label', type: 'string', description: 'Display name' },
      { name: 'points', label: 'Points', type: 'array', description: 'Flat [x,y,z,...] vertex coordinates' },
      { name: 'paths', label: 'Paths', type: 'array', description: 'Flat vertex indices (all paths concatenated)' },
      { name: 'offsets', label: 'Offsets', type: 'array', description: 'Path boundaries [0, n0, n0+n1, ...] (length = nPaths + 1)' },
      { name: 'transform', label: 'Transform', type: 'array', description: '16 floats, row-major 4x4 (optional)' },
      { name: 'parentId', label: 'Parent', type: 'string', description: 'Parent node ID (optional)' },
      { name: 'color', label: 'Color', type: 'string', description: 'Hex color (optional)' },
    ],
    execute: (_, p) => {
      const label = p.label as string
      const points = p.points as number[]
      const paths = p.paths as number[]
      const offsets = p.offsets as number[]
      if (points.length % 3 !== 0) throw new Error('points length must be divisible by 3')
      const parentId = (p.parentId as string | undefined) ?? null
      if (parentId && !ctx.scene.getNode(parentId)) throw new Error(`Parent node not found: ${parentId}`)
      const offsetsND = tf.ndarray(new Int32Array(offsets))
      const dataND = tf.ndarray(new Int32Array(paths))
      const pathsBuf = tf.offsetBlockedBuffer(offsetsND, dataND)
      const curves = tf.curves(pathsBuf, new Float32Array(points))
      offsetsND.delete()
      dataND.delete()
      setRawTransform(curves, p.transform)
      const id = operands.nextId('curves')
      operands.add({ id, type: 'curves', data: curves })
      const color = (p.color as string | undefined) ?? '#ffffff'
      ctx.scene.addNode({
        id,
        label,
        parentId,
        order: 0,
        operandId: id,
        visible: true,
        color,
        opacity: 100,
        renderMode: 'solid',
      })
      return returnCreated(id, label, 'curves')
    },
  })

  register({
    id: 'scene.add_ndarray',
    label: 'Add NDArray',
    description: 'Add a scalar/vector field as child of an existing node',
    category: 'scene',
    inputs: [
      { name: 'label', label: 'Label', type: 'string', description: 'Display name' },
      { name: 'data', label: 'Data', type: 'array', description: 'Flat values' },
      { name: 'shape', label: 'Shape', type: 'array', description: 'Dimensions, e.g. [1000] or [1000, 3]' },
      { name: 'dtype', label: 'Dtype', type: 'string', description: "'float32' (default) or 'int32'" },
      { name: 'parentId', label: 'Parent', type: 'string', description: 'Parent node ID (required)' },
      { name: 'color', label: 'Color', type: 'string', description: 'Hex color (optional)' },
    ],
    execute: (_, p) => {
      const label = p.label as string
      const data = p.data as number[]
      const shape = p.shape as number[]
      const dtype = (p.dtype as string | undefined) ?? 'float32'
      const parentId = p.parentId as string
      if (!parentId || !ctx.scene.getNode(parentId)) throw new Error(`Parent node not found: ${parentId}`)
      if (dtype !== 'float32' && dtype !== 'int32') throw new Error("dtype must be 'float32' or 'int32'")
      const expected = shape.reduce((a, b) => a * b, 1)
      if (data.length !== expected)
        throw new Error(`data length ${data.length} does not match shape ${shape} (expected ${expected})`)
      const arr = dtype === 'int32' ? tf.ndarray(new Int32Array(data), shape) : tf.ndarray(new Float32Array(data), shape)
      const id = operands.nextId('ndarray')
      operands.add({ id, type: 'ndarray', data: arr })
      const color = (p.color as string | undefined) ?? '#ffffff'
      ctx.scene.addNode({
        id,
        label,
        parentId,
        order: 0,
        operandId: id,
        visible: true,
        color,
        opacity: 100,
        renderMode: 'solid',
      })
      return returnCreated(id, label, 'ndarray')
    },
  })

  register({
    id: 'tf.analysis',
    label: 'Analysis',
    description:
      'Full mesh analysis: topology, quality, measurements, curvature stats. Returns structured report. Adds diagnostic curves to scene only when issues are found.',
    category: 'inspect',
    inputs: [],
    usesNodeIds: true,
    execute: async (nodeIds) => {
      const reports = await Promise.all(nodeIds.map((id) => generateReport(id, ctx.scene)))
      return { reports }
    },
  })
}
