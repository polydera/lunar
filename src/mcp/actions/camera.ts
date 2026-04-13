import * as THREE from 'three'
import type { ActionRegistrar } from '../types'

export function registerCameraActions({ register, ctx, roundArr }: ActionRegistrar) {
  register({
    id: 'camera.fit_to_scene',
    label: 'Fit to Scene',
    description: 'Frame all visible meshes',
    category: 'camera',
    inputs: [],
    execute: () => {
      ctx.getViewport()?.fitToScene()
      return { ok: true }
    },
  })

  register({
    id: 'camera.fit_to_nodes',
    label: 'Fit to Nodes',
    description: 'Frame specific nodes',
    category: 'camera',
    inputs: [{ name: 'nodeIds', label: 'Node IDs', type: 'array', description: 'Node IDs to frame' }],
    execute: (_, p) => {
      ctx.getViewport()?.fitToNodes(p.nodeIds as string[])
      return { ok: true }
    },
  })

  register({
    id: 'camera.align_to_axis',
    label: 'Align to Axis',
    description: 'Snap camera to axis view',
    category: 'camera',
    inputs: [{ name: 'axis', label: 'Axis', type: 'string', description: 'View direction', enum: ['X', '-X', 'Y', '-Y', 'Z', '-Z'] }],
    execute: (_, p) => {
      ctx.getViewport()?.alignCameraToAxis(p.axis as string)
      return { ok: true }
    },
  })

  register({
    id: 'camera.describe',
    label: 'Describe Camera',
    description:
      'Get camera orientation: position, target, and image axes (what directions are left/right/up/down in the viewport)',
    category: 'camera',
    inputs: [],
    execute: () => {
      const viewport = ctx.getViewport()
      if (!viewport) throw new Error('Viewport not initialized')
      const cam = viewport.camera
      const tgt = viewport.cameraTarget
      const forward = new THREE.Vector3().subVectors(tgt, cam.position).normalize()
      const right = new THREE.Vector3().crossVectors(forward, cam.up).normalize()
      const up = new THREE.Vector3().crossVectors(right, forward).normalize()
      return {
        position: roundArr([cam.position.x, cam.position.y, cam.position.z]),
        target: roundArr([tgt.x, tgt.y, tgt.z]),
        imageRight: roundArr([right.x, right.y, right.z]),
        imageUp: roundArr([up.x, up.y, up.z]),
        imageInto: roundArr([forward.x, forward.y, forward.z]),
      }
    },
  })
}
