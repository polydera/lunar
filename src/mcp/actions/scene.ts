import * as THREE from 'three'
import * as tf from '@polydera/trueform'
import { operands } from '@/core'
import { copyTransform } from '@/core/utils'
import type { ActionRegistrar } from '../types'

export function registerSceneActions({
  register,
  ctx,
  resolveTargets,
  applyTransform,
  sanitizeProperties,
}: ActionRegistrar) {
  register({
    id: 'scene.select',
    label: 'Select',
    description: 'Select nodes',
    category: 'scene',
    inputs: [
      { name: 'nodeIds', label: 'Node IDs', type: 'array', description: 'Node IDs to select' },
      { name: 'add', label: 'Add', type: 'boolean', description: 'Add to existing selection', default: false },
    ],
    execute: (_, p) => {
      const ids = p.nodeIds as string[]
      if (!p.add) ctx.scene.clearSelection()
      for (const id of ids) ctx.scene.select(id, true)
      return { ok: true }
    },
  })

  register({
    id: 'scene.deselect',
    label: 'Deselect',
    description: 'Remove nodes from selection',
    category: 'scene',
    inputs: [{ name: 'nodeIds', label: 'Node IDs', type: 'array', description: 'Node IDs to deselect' }],
    execute: (_, p) => {
      for (const id of p.nodeIds as string[]) ctx.scene.deselect(id)
      return { ok: true }
    },
  })

  register({
    id: 'scene.clear_selection',
    label: 'Clear Selection',
    description: 'Clear all selection',
    category: 'scene',
    inputs: [],
    execute: () => {
      ctx.scene.clearSelection()
      return { ok: true }
    },
  })

  register({
    id: 'scene.delete',
    label: 'Delete',
    description: 'Delete nodes',
    category: 'scene',
    inputs: [],
    usesNodeIds: 'optional',
    execute: (nodeIds) => {
      const targets = resolveTargets(nodeIds)
      for (const id of targets) ctx.scene.removeNode(id)
      return { ok: true, deleted: targets }
    },
  })

  register({
    id: 'scene.duplicate',
    label: 'Duplicate',
    description: 'Duplicate mesh nodes',
    category: 'scene',
    inputs: [],
    usesNodeIds: true,
    execute: (nodeIds) => {
      const newIds: string[] = []
      for (const nodeId of nodeIds) {
        const node = ctx.scene.getNode(nodeId)
        if (!node?.operandId) continue
        const operand = operands.get(node.operandId)
        if (!operand || operand.type !== 'mesh') continue
        const original = operand.data as tf.Mesh
        const copy = original.shallowCopy()
        copyTransform(original, copy)
        const id = operands.nextId(node.label)
        operands.add({ id, type: 'mesh', data: copy })
        ctx.scene.addNode({
          id,
          label: `${node.label} copy`,
          parentId: null,
          order: 0,
          operandId: id,
          visible: true,
          color: node.color,
          opacity: node.opacity,
          renderMode: node.renderMode,
        })
        newIds.push(id)
      }
      return { ok: true, newIds }
    },
  })

  register({
    id: 'scene.set_visible',
    label: 'Set Visible',
    description: 'Show or hide nodes',
    category: 'scene',
    inputs: [{ name: 'visible', label: 'Visible', type: 'boolean', description: 'true to show, false to hide' }],
    usesNodeIds: true,
    execute: (nodeIds, p) => {
      for (const id of nodeIds) ctx.scene.setVisible(id, p.visible as boolean)
      return { ok: true }
    },
  })

  register({
    id: 'scene.set_color',
    label: 'Set Color',
    description: 'Set mesh color',
    category: 'scene',
    inputs: [{ name: 'color', label: 'Color', type: 'string', description: 'Hex color e.g. "#ff0000"' }],
    usesNodeIds: true,
    execute: (nodeIds, p) => {
      for (const id of nodeIds) ctx.scene.setColor(id, p.color as string)
      return { ok: true }
    },
  })

  register({
    id: 'scene.set_opacity',
    label: 'Set Opacity',
    description: 'Set mesh opacity 0-100',
    category: 'scene',
    inputs: [{ name: 'opacity', label: 'Opacity', type: 'number', description: '0 (transparent) to 100 (opaque)', min: 0, max: 100 }],
    usesNodeIds: true,
    execute: (nodeIds, p) => {
      for (const id of nodeIds) ctx.scene.setOpacity(id, p.opacity as number)
      return { ok: true }
    },
  })

  register({
    id: 'scene.set_render_mode',
    label: 'Set Render Mode',
    description: 'Set render mode',
    category: 'scene',
    inputs: [{ name: 'mode', label: 'Mode', type: 'string', description: 'Render mode', enum: ['solid', 'wireframe', 'points'] }],
    usesNodeIds: true,
    execute: (nodeIds, p) => {
      for (const id of nodeIds) ctx.scene.setRenderMode(id, p.mode as 'solid' | 'wireframe' | 'points')
      return { ok: true }
    },
  })

  register({
    id: 'scene.rename',
    label: 'Rename',
    description: 'Rename a node',
    category: 'scene',
    inputs: [{ name: 'label', label: 'Label', type: 'string', description: 'New name' }],
    usesNodeIds: true,
    execute: (nodeIds, p) => {
      ctx.scene.setLabel(nodeIds[0]!, p.label as string)
      return { ok: true }
    },
  })

  register({
    id: 'scene.translate',
    label: 'Translate',
    description: 'Move nodes by offset',
    category: 'scene',
    inputs: [{ name: 'xyz', label: 'XYZ', type: 'array', description: '[x, y, z] offset' }],
    usesNodeIds: 'optional',
    execute: (nodeIds, p) => {
      const targets = resolveTargets(nodeIds)
      const xyz = p.xyz as number[]
      for (const id of targets) {
        applyTransform(id, (m) => new THREE.Matrix4().makeTranslation(xyz[0]!, xyz[1]!, xyz[2]!).multiply(m))
      }
      return { ok: true, targets }
    },
  })

  register({
    id: 'scene.set_position',
    label: 'Set Position',
    description: 'Set absolute position',
    category: 'scene',
    inputs: [{ name: 'xyz', label: 'XYZ', type: 'array', description: '[x, y, z] world position' }],
    usesNodeIds: 'optional',
    execute: (nodeIds, p) => {
      const targets = resolveTargets(nodeIds)
      const xyz = p.xyz as number[]
      for (const id of targets) {
        applyTransform(id, (m) => {
          m.setPosition(xyz[0]!, xyz[1]!, xyz[2]!)
          return m
        })
      }
      return { ok: true, targets }
    },
  })

  register({
    id: 'scene.rotate',
    label: 'Rotate',
    description: 'Rotate around own center',
    category: 'scene',
    inputs: [
      { name: 'axis', label: 'Axis', type: 'string', description: 'Rotation axis', enum: ['X', 'Y', 'Z'] },
      { name: 'degrees', label: 'Degrees', type: 'number', description: 'Angle in degrees' },
    ],
    usesNodeIds: 'optional',
    execute: (nodeIds, p) => {
      const targets = resolveTargets(nodeIds)
      const axisVec = { X: new THREE.Vector3(1, 0, 0), Y: new THREE.Vector3(0, 1, 0), Z: new THREE.Vector3(0, 0, 1) }[
        p.axis as string
      ]
      if (!axisVec) throw new Error(`Invalid axis: ${p.axis}`)
      for (const id of targets) {
        applyTransform(id, (m) => {
          const center = new THREE.Vector3().setFromMatrixPosition(m)
          const toOrigin = new THREE.Matrix4().makeTranslation(-center.x, -center.y, -center.z)
          const fromOrigin = new THREE.Matrix4().makeTranslation(center.x, center.y, center.z)
          const rot = new THREE.Matrix4().makeRotationAxis(axisVec, THREE.MathUtils.degToRad(p.degrees as number))
          return new THREE.Matrix4().multiply(fromOrigin).multiply(rot).multiply(toOrigin).multiply(m)
        })
      }
      return { ok: true, targets }
    },
  })

  register({
    id: 'scene.scale',
    label: 'Scale',
    description: 'Scale around own center',
    category: 'scene',
    inputs: [{ name: 'factor', label: 'Factor', type: 'number', description: 'Uniform factor, or [x,y,z] for non-uniform' }],
    usesNodeIds: 'optional',
    execute: (nodeIds, p) => {
      const targets = resolveTargets(nodeIds)
      const factor = p.factor as number | number[]
      const fx = typeof factor === 'number' ? factor : factor[0]!
      const fy = typeof factor === 'number' ? factor : factor[1]!
      const fz = typeof factor === 'number' ? factor : factor[2]!
      for (const id of targets) {
        applyTransform(id, (m) => {
          const center = new THREE.Vector3().setFromMatrixPosition(m)
          const toOrigin = new THREE.Matrix4().makeTranslation(-center.x, -center.y, -center.z)
          const fromOrigin = new THREE.Matrix4().makeTranslation(center.x, center.y, center.z)
          return new THREE.Matrix4()
            .multiply(fromOrigin)
            .multiply(new THREE.Matrix4().makeScale(fx, fy, fz))
            .multiply(toOrigin)
            .multiply(m)
        })
      }
      return { ok: true, targets }
    },
  })

  register({
    id: 'scene.set_transform',
    label: 'Set Transform',
    description: 'Set raw 4x4 transformation matrix',
    category: 'scene',
    inputs: [{ name: 'transform', label: 'Transform', type: 'array', description: '16 floats, row-major 4x4' }],
    usesNodeIds: 'optional',
    execute: (nodeIds, p) => {
      const targets = resolveTargets(nodeIds)
      const transform = p.transform as number[]
      if (!transform || transform.length !== 16) throw new Error('transform must be 16 numbers')
      for (const id of targets) {
        const node = ctx.scene.getNode(id)
        if (!node?.operandId) continue
        const operand = operands.get(node.operandId)
        if (!operand) continue
        const m = tf.ndarray(new Float32Array(transform)).reshape([4, 4])
        ;(operand.data as any).transformation = m
        m.delete()
        ctx.scene.dirty.add(id)
      }
      return { ok: true, targets }
    },
  })

  register({
    id: 'scene.import_url',
    label: 'Import URL',
    description: 'Download and import a mesh from URL',
    category: 'scene',
    inputs: [
      { name: 'url', label: 'URL', type: 'string', description: 'Mesh file URL (.stl or .obj)' },
      { name: 'name', label: 'Name', type: 'string', description: 'Label for imported mesh' },
    ],
    execute: async (_, p) => {
      const url = p.url as string
      const name =
        (p.name as string | undefined) ??
        url
          .split('/')
          .pop()
          ?.replace(/\.[^.]+$/, '') ??
        'mesh'
      const beforeIds = new Set(ctx.scene.nodes.keys())
      await ctx.importFromUrl(url, name)
      const created: unknown[] = []
      for (const [id, node] of ctx.scene.nodes) {
        if (beforeIds.has(id)) continue
        const operand = node.operandId ? operands.get(node.operandId) : undefined
        const properties = node.operandId ? ctx.scene.getProperties(node.operandId) : undefined
        created.push({
          id: node.id,
          label: node.label,
          type: operand?.type,
          properties: properties ? sanitizeProperties(properties) : undefined,
        })
      }
      return { created, totalNodes: ctx.scene.nodes.size }
    },
  })

  register({
    id: 'scene.screenshot',
    label: 'Screenshot',
    description: 'Capture the viewport as an image',
    category: 'scene',
    inputs: [],
    execute: async () => {
      const viewport = ctx.getViewport()
      if (!viewport) throw new Error('Viewport not initialized')
      await new Promise<void>((r) => requestAnimationFrame(() => requestAnimationFrame(() => r())))
      const src = viewport.renderer.domElement
      const maxW = 1200
      const scale = Math.min(1, maxW / src.width)
      const w = Math.round(src.width * scale)
      const h = Math.round(src.height * scale)
      const offscreen = document.createElement('canvas')
      offscreen.width = w
      offscreen.height = h
      offscreen.getContext('2d')!.drawImage(src, 0, 0, w, h)
      const dataUrl = offscreen.toDataURL('image/jpeg', 0.85)
      return { __image: true, data: dataUrl.replace(/^data:image\/jpeg;base64,/, ''), mimeType: 'image/jpeg' }
    },
  })
}
