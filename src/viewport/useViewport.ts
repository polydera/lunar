import * as THREE from 'three'
import * as tf from '@polydera/trueform'
import type { useScene } from '@/scene/useScene'
import { operands } from '@/core'
import { prefs } from '@/composables/usePreferences'
import { updateCameraRotation } from './cameraState'
import { useInteraction } from './useInteraction'
import { useSceneSync } from './useSceneSync'
import type { Mesh } from '@polydera/trueform'

type Scene = ReturnType<typeof useScene>

export interface PickResult {
  nodeId: string
  operandId: string
  t: number
  point: THREE.Vector3
  elementId: number
}

export function useViewport(container: HTMLElement, scene: Scene) {
  // ── Renderer ─────────────────────────────────────────────

  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true })
  renderer.outputColorSpace = THREE.SRGBColorSpace
  renderer.toneMapping = THREE.ACESFilmicToneMapping
  renderer.toneMappingExposure = 1.0
  renderer.setPixelRatio(window.devicePixelRatio)
  renderer.setSize(container.clientWidth, container.clientHeight)
  container.appendChild(renderer.domElement)

  // ── Three.js scene ────────────────────────────────────────

  const threeScene = new THREE.Scene()

  threeScene.add(new THREE.AmbientLight(0x404040, 0.4))

  const hemiLight = new THREE.HemisphereLight(0xf2f5ff, 0x1a1614, 0.6)
  hemiLight.position.set(0, 200, 0)
  threeScene.add(hemiLight)

  const dirLight = new THREE.DirectionalLight(0xffffff, 0.9)
  dirLight.position.set(60, 120, 80)
  threeScene.add(dirLight)

  const fillLight = new THREE.DirectionalLight(0xfefaf3, 0.25)
  fillLight.position.set(-30, 50, -30)
  threeScene.add(fillLight)

  const rimLight = new THREE.DirectionalLight(0xdde6ff, 0.25)
  rimLight.position.set(-50, 20, -100)
  threeScene.add(rimLight)

  // ── Camera ────────────────────────────────────────────────

  const aspect = container.clientWidth / container.clientHeight
  const frustumSize = 50
  const camera = new THREE.OrthographicCamera(
    (-frustumSize * aspect) / 2,
    (frustumSize * aspect) / 2,
    frustumSize / 2,
    -frustumSize / 2,
    -10000,
    10000,
  )
  camera.position.set(0, 0, 50)
  camera.lookAt(0, 0, 0)
  threeScene.add(camera)

  const cameraTarget = new THREE.Vector3(0, 0, 0)

  // ── Camera sync: clip planes + zoom limits ──────────────

  let sceneBoundsDirty = true
  let cameraClipDirty = true
  const sceneSphere = new THREE.Sphere()
  let minZoom = 0.001
  let maxZoom = 100000

  function markCameraDirty() {
    cameraClipDirty = true
  }

  function rebuildSceneBounds() {
    const box = new THREE.Box3()
    threeScene.traverse((child) => {
      if (child instanceof THREE.Mesh && child.visible) box.expandByObject(child)
    })
    if (box.isEmpty()) {
      sceneSphere.center.set(0, 0, 0)
      sceneSphere.radius = 1
    } else {
      box.getBoundingSphere(sceneSphere)
    }
  }

  function syncCamera() {
    if (!sceneBoundsDirty && !cameraClipDirty) return
    if (sceneBoundsDirty) {
      rebuildSceneBounds()
      sceneBoundsDirty = false
    }

    const camDir = new THREE.Vector3()
    camera.getWorldDirection(camDir)
    const offset = sceneSphere.center.clone().sub(camera.position)
    const centerDistance = offset.dot(camDir)
    const radius = Math.max(sceneSphere.radius, 1) * 3
    camera.near = centerDistance - radius
    camera.far = centerDistance + radius

    const sceneDiameter = Math.max(sceneSphere.radius * 2, 1)
    const frustumAtZoom1 = camera.top - camera.bottom
    if (frustumAtZoom1 > 0) {
      minZoom = Math.max(0.0001, frustumAtZoom1 / (sceneDiameter * 20))
      maxZoom = Math.min(1e6, frustumAtZoom1 / (sceneDiameter * 0.01))
    }

    camera.updateProjectionMatrix()
    cameraClipDirty = false
  }

  // ── Scene sync ────────────────────────────────────────────

  const sceneSync = useSceneSync(threeScene, scene)

  // ── Picking ──────────────────────────────────────────────

  const raycaster = new THREE.Raycaster()
  const ndc = new THREE.Vector2()

  function updateNDC(e: MouseEvent) {
    const rect = container.getBoundingClientRect()
    ndc.x = ((e.clientX - rect.left) / rect.width) * 2 - 1
    ndc.y = -((e.clientY - rect.top) / rect.height) * 2 + 1
  }

  function updateNDCFromXY(x: number, y: number) {
    const rect = container.getBoundingClientRect()
    ndc.x = ((x - rect.left) / rect.width) * 2 - 1
    ndc.y = -((y - rect.top) / rect.height) * 2 + 1
  }

  function pick(): PickResult | null {
    raycaster.setFromCamera(ndc, camera)
    const o = raycaster.ray.origin
    const d = raycaster.ray.direction
    const tfRay = tf.ray([o.x, o.y, o.z, d.x, d.y, d.z])

    let bestT = Infinity
    let bestNodeId: string | null = null
    let bestOperandId: string | null = null
    let bestElementId = -1

    for (const [nodeId, node] of scene.nodes) {
      if (!node.visible || node.pickable === false || !node.operandId) continue
      const operand = operands.get(node.operandId)
      if (!operand || operand.type !== 'mesh') continue

      const mesh = operand.data as Mesh
      const result = tf.rayCast(tfRay, mesh, { maxT: bestT }) as tf.RayCastResult
      if (result.hit && result.t < bestT) {
        bestT = result.t
        bestNodeId = nodeId
        bestOperandId = node.operandId
        bestElementId = result.elementId
      }
    }

    tfRay.delete()

    if (bestNodeId === null) return null
    const point = raycaster.ray.at(bestT, new THREE.Vector3())
    return { nodeId: bestNodeId, operandId: bestOperandId!, t: bestT, point, elementId: bestElementId }
  }

  // ── Zoom-to-cursor (wheel) ────────────────────────────────

  function normalizeWheelDelta(event: WheelEvent): number {
    let delta = event.deltaY
    switch (event.deltaMode) {
      case 1:
        delta *= 16
        break // LINE mode (Firefox)
      case 2:
        delta *= 100
        break // PAGE mode (rare)
    }
    if (event.ctrlKey) delta *= 10 // trackpad pinch
    return delta
  }

  function getZoomScale(delta: number): number {
    const normalized = Math.abs(delta * 0.01)
    return Math.pow(0.95, prefs.zoomSpeed * normalized)
  }

  function zoomAtPoint(screenX: number, screenY: number, factor: number) {
    syncCamera()
    const rect = container.getBoundingClientRect()
    const zoomNdc = new THREE.Vector2(
      ((screenX - rect.left) / rect.width) * 2 - 1,
      -((screenY - rect.top) / rect.height) * 2 + 1,
    )

    const before = new THREE.Vector3(zoomNdc.x, zoomNdc.y, 0).unproject(camera)
    const nextZoom = camera.zoom * factor
    const clamped = Math.max(minZoom, Math.min(maxZoom, nextZoom))
    if (clamped === camera.zoom) return
    camera.zoom = clamped
    camera.updateProjectionMatrix()

    const after = new THREE.Vector3(zoomNdc.x, zoomNdc.y, 0).unproject(camera)
    const shift = new THREE.Vector3().subVectors(before, after)
    camera.position.add(shift)
    cameraTarget.add(shift)
    camera.updateMatrixWorld()

    cameraClipDirty = true
  }

  function onWheel(event: WheelEvent) {
    event.preventDefault()
    updateNDC(event)

    const delta = normalizeWheelDelta(event)
    if (delta === 0) return
    const scale = getZoomScale(delta)
    const factor = delta < 0 ? 1 / scale : scale

    if (interaction.handleScaleSelection(event, factor)) {
      cameraClipDirty = true
      return
    }

    zoomAtPoint(event.clientX, event.clientY, factor)
  }

  // ── Interaction ──────────────────────────────────────────

  const interaction = useInteraction({
    container,
    camera,
    cameraTarget,
    scene,
    raycaster,
    ndc,
    updateNDC,
    updateNDCFromXY,
    pick,
    syncCamera,
    markCameraDirty,
    zoomAtPoint,
    fitToScene: () => fitToScene(),
    fitToNodes: (ids: string[]) => fitToNodes(ids),
  })

  renderer.domElement.addEventListener('wheel', onWheel, { passive: false })

  // ── Camera framing ────────────────────────────────────────

  function frameBox(box: THREE.Box3, offset = 1.5) {
    if (box.isEmpty()) return

    const center = box.getCenter(new THREE.Vector3())
    const size = box.getSize(new THREE.Vector3())
    const maxDim = Math.max(size.x, size.y, size.z) * offset
    const diagonal = size.length()

    const frustumHeight = camera.top - camera.bottom
    const frustumWidth = camera.right - camera.left
    const zoomH = frustumHeight / maxDim
    const zoomW = frustumWidth / (maxDim * (container.clientWidth / container.clientHeight))
    camera.zoom = Math.min(zoomH, zoomW)
    camera.updateProjectionMatrix()

    const dir = new THREE.Vector3()
    camera.getWorldDirection(dir)
    camera.position.copy(center).addScaledVector(dir, -diagonal * 5)
    cameraTarget.copy(center)
    camera.updateMatrixWorld()
    cameraClipDirty = true
  }

  function fitToScene(offset = 1.5) {
    const box = new THREE.Box3()
    threeScene.traverse((child) => {
      if (child instanceof THREE.Mesh) box.expandByObject(child)
    })
    frameBox(box, offset)
  }

  function fitToNodes(nodeIds: string[], offset = 1.5) {
    const box = new THREE.Box3()
    for (const id of nodeIds) {
      const obj = sceneSync.threeObjects.get(id)
      if (obj) box.expandByObject(obj)
    }
    frameBox(box, offset)
  }

  function alignCameraToAxis(axis: string) {
    // Rotate camera 90° around the clicked axis.
    // Positive dot = +90°, negative dot = -90°. Click 4 times = full 360°.
    const axisVecs: Record<string, THREE.Vector3> = {
      X: new THREE.Vector3(1, 0, 0),
      '-X': new THREE.Vector3(1, 0, 0),
      Y: new THREE.Vector3(0, 1, 0),
      '-Y': new THREE.Vector3(0, 1, 0),
      Z: new THREE.Vector3(0, 0, 1),
      '-Z': new THREE.Vector3(0, 0, 1),
    }
    const axisVec = axisVecs[axis]
    if (!axisVec) return

    const angle = axis.startsWith('-') ? -Math.PI / 2 : Math.PI / 2

    // Rotate camera position around cameraTarget
    const offset = camera.position.clone().sub(cameraTarget)
    offset.applyAxisAngle(axisVec, angle)
    camera.position.copy(cameraTarget).add(offset)

    // Rotate up vector to match
    camera.up.applyAxisAngle(axisVec, angle)

    camera.lookAt(cameraTarget)
    camera.updateMatrix()
    camera.updateMatrixWorld()
    camera.updateProjectionMatrix()
    cameraClipDirty = true
  }

  function snapCameraToAxis(axis: string) {
    // Snap camera to look along the given axis direction.
    // Uses the closest natural up vector (Y-up for side views, ±Z for top/bottom).
    const dist = camera.position.distanceTo(cameraTarget)
    const dirs: Record<string, { pos: THREE.Vector3; up: THREE.Vector3 }> = {
      X: { pos: new THREE.Vector3(1, 0, 0), up: new THREE.Vector3(0, 1, 0) },
      '-X': { pos: new THREE.Vector3(-1, 0, 0), up: new THREE.Vector3(0, 1, 0) },
      Y: { pos: new THREE.Vector3(0, 1, 0), up: new THREE.Vector3(0, 0, -1) },
      '-Y': { pos: new THREE.Vector3(0, -1, 0), up: new THREE.Vector3(0, 0, -1) },
      Z: { pos: new THREE.Vector3(0, 0, 1), up: new THREE.Vector3(0, 1, 0) },
      '-Z': { pos: new THREE.Vector3(0, 0, -1), up: new THREE.Vector3(0, 1, 0) },
    }
    const entry = dirs[axis]
    if (!entry) return
    camera.position.copy(cameraTarget).addScaledVector(entry.pos, dist)
    camera.up.copy(entry.up)
    camera.lookAt(cameraTarget)
    camera.updateMatrix()
    camera.updateMatrixWorld()
    camera.updateProjectionMatrix()
    cameraClipDirty = true
  }

  // ── Render loop ──────────────────────────────────────────

  let animationId = 0

  function animate() {
    animationId = requestAnimationFrame(animate)

    const dirtyIds = scene.consumeDirty()
    if (dirtyIds.size > 0) sceneBoundsDirty = true
    for (const id of dirtyIds) {
      sceneSync.syncNode(id)
    }

    syncCamera()
    updateCameraRotation(camera.matrixWorld.elements)
    renderer.render(threeScene, camera)
  }

  animationId = requestAnimationFrame(animate)

  // ── Resize ───────────────────────────────────────────────

  const resizeObserver = new ResizeObserver(() => {
    const w = container.clientWidth
    const h = container.clientHeight
    const a = w / h
    const frustumH = camera.top - camera.bottom
    camera.left = (-frustumH * a) / 2
    camera.right = (frustumH * a) / 2
    camera.updateProjectionMatrix()
    renderer.setSize(w, h)
  })
  resizeObserver.observe(container)

  // ── Cleanup ──────────────────────────────────────────────

  function dispose() {
    cancelAnimationFrame(animationId)
    resizeObserver.disconnect()
    renderer.domElement.removeEventListener('wheel', onWheel)
    interaction.dispose()
    sceneSync.dispose()

    renderer.dispose()
    if (container.contains(renderer.domElement)) {
      container.removeChild(renderer.domElement)
    }
  }

  return {
    camera,
    renderer,
    cameraTarget,
    pick,
    fitToScene,
    fitToNodes,
    alignCameraToAxis,
    snapCameraToAxis,
    mode: interaction.mode,
    stickyMode: interaction.stickyMode,
    lockedAxis: interaction.lockedAxis,
    clearStickyMode: interaction.clearStickyMode,
    toggleStickyTransform: interaction.toggleStickyTransform,
    toggleStickyOrbit: interaction.toggleStickyOrbit,
    setAxisLock: interaction.setAxisLock,
    clearAxisLock: interaction.clearAxisLock,
    rotateSelection90: interaction.rotateSelection90,
    dispose,
  }
}
