import * as THREE from 'three'
import * as tf from '@polydera/trueform'
import { shallowRef } from 'vue'
import type { useScene } from '@/scene/useScene'
import { operands } from '@/core'
import type { PickResult } from './useViewport'

type Scene = ReturnType<typeof useScene>

interface InteractionDeps {
  container: HTMLElement
  camera: THREE.OrthographicCamera
  cameraTarget: THREE.Vector3
  scene: Scene
  raycaster: THREE.Raycaster
  ndc: THREE.Vector2
  updateNDC: (e: PointerEvent) => void
  updateNDCFromXY: (x: number, y: number) => void
  pick: () => PickResult | null
  syncCamera: () => void
  markCameraDirty: () => void
  zoomAtPoint: (screenX: number, screenY: number, factor: number) => void
  fitToScene: () => void
  fitToNodes: (nodeIds: string[]) => void
}

export type InteractionMode = 'move' | 'transform' | 'orbit' | 'append'
export type AxisLock = 'X' | 'Y' | 'Z' | null

export function useInteraction({
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
  fitToScene,
  fitToNodes,
}: InteractionDeps) {
  // ── Mode ──────────────────────────────────────────────────
  //
  // Momentary: hold T/C/Ctrl → mode active while held; release → previous.
  // Sticky:    Shift+T/C → mode persists after release. N or Escape clears.
  // Momentary always overrides sticky.

  const keysDown = new Set<string>()
  const mode = shallowRef<InteractionMode>('move')
  const stickyMode = shallowRef<InteractionMode | null>(null)

  function updateMode() {
    if (keysDown.has('control') || keysDown.has('meta')) mode.value = 'append'
    else if (keysDown.has('c')) mode.value = 'orbit'
    else if (keysDown.has('t')) mode.value = 'transform'
    else mode.value = stickyMode.value ?? 'move'
  }

  function toggleStickyTransform() {
    stickyMode.value = stickyMode.value === 'transform' ? null : 'transform'
    updateMode()
  }

  function toggleStickyOrbit() {
    stickyMode.value = stickyMode.value === 'orbit' ? null : 'orbit'
    updateMode()
  }

  function clearStickyMode(): boolean {
    if (stickyMode.value === null) return false
    stickyMode.value = null
    updateMode()
    return true
  }

  // ── Axis constraint ─────────────────────────────────────
  //
  // Shift+click an axis on the AxesWidget to lock transforms to that axis.
  // Locked: drag rotates only around the locked world axis; scroll scales
  // only along it. Cleared by N, Escape, or Shift+click toggle.

  const lockedAxis = shallowRef<AxisLock>(null)

  function setAxisLock(axis: 'X' | 'Y' | 'Z' | null) {
    lockedAxis.value = axis
  }

  function clearAxisLock(): boolean {
    if (lockedAxis.value === null) return false
    lockedAxis.value = null
    return true
  }

  let pointerOverViewport = false
  const onPointerEnter = () => {
    pointerOverViewport = true
  }
  const onPointerLeave = () => {
    pointerOverViewport = false
  }
  const onContextMenu = (e: Event) => e.preventDefault()
  container.addEventListener('pointerenter', onPointerEnter)
  container.addEventListener('pointerleave', onPointerLeave)

  let dragging = false
  let dragNodeIds: string[] = []
  let dragCenter: THREE.Vector3 | null = null
  const DRAG_THRESHOLD = 4
  let pointerDownPos = { x: 0, y: 0 }
  let lastPointerPos = { x: 0, y: 0 }
  let pointerDownPick: PickResult | null = null
  let pointerIsDown = false
  let activePointerId = -1
  let maybeDrag = false
  let pointerMoved = false
  let pointerDownShift = false
  let dragPanning = false

  const movingPlane = new THREE.Plane()
  const lastPoint = new THREE.Vector3()

  // ── Touch state ──────────────────────────────────────────

  const touchPointers = new Map<number, { x: number; y: number }>()
  let touchState: 'none' | 'pending' | 'one_drag' | 'two_finger' | 'long_press' = 'none'
  let touchStartPos = { x: 0, y: 0 }
  let touchStartTime = 0
  let touchLastTapTime = 0
  let touchLongPressTimer: ReturnType<typeof setTimeout> | null = null
  let touchPrevPinchDist = 0
  let touchPrevMidpoint = { x: 0, y: 0 }
  let touchDragPick: PickResult | null = null
  let touchDragNodeIds: string[] = []
  const TOUCH_DRAG_THRESHOLD = 10
  const LONG_PRESS_MS = 500
  const DOUBLE_TAP_MS = 300

  function touchPinchDist(): number {
    const pts = [...touchPointers.values()]
    if (pts.length < 2) return 0
    return Math.hypot(pts[1]!.x - pts[0]!.x, pts[1]!.y - pts[0]!.y)
  }

  function touchMidpoint(): { x: number; y: number } {
    const pts = [...touchPointers.values()]
    if (pts.length < 2) return pts[0] ?? { x: 0, y: 0 }
    return { x: (pts[0]!.x + pts[1]!.x) / 2, y: (pts[0]!.y + pts[1]!.y) / 2 }
  }

  function cancelLongPress() {
    if (touchLongPressTimer) {
      clearTimeout(touchLongPressTimer)
      touchLongPressTimer = null
    }
  }

  function onTouchPointerDown(e: PointerEvent) {
    touchPointers.set(e.pointerId, { x: e.clientX, y: e.clientY })
    container.setPointerCapture(e.pointerId)

    if (touchPointers.size === 1) {
      touchState = 'pending'
      touchStartPos = { x: e.clientX, y: e.clientY }
      touchStartTime = Date.now()
      updateNDCFromXY(e.clientX, e.clientY)
      touchDragPick = pick()
      touchLongPressTimer = setTimeout(() => {
        if (touchState === 'pending' && touchDragPick) {
          touchState = 'long_press'
          scene.handleSelect(touchDragPick.nodeId, true)
        }
      }, LONG_PRESS_MS)
    } else if (touchPointers.size === 2) {
      cancelLongPress()
      touchState = 'two_finger'
      touchPrevPinchDist = touchPinchDist()
      touchPrevMidpoint = touchMidpoint()
      // Reset any in-progress one-finger drag
      dragging = false
      dragNodeIds = []
    }
  }

  function onTouchPointerMove(e: PointerEvent) {
    if (!touchPointers.has(e.pointerId)) return
    const prev = touchPointers.get(e.pointerId)!
    touchPointers.set(e.pointerId, { x: e.clientX, y: e.clientY })

    if (touchState === 'pending') {
      const dx = e.clientX - touchStartPos.x
      const dy = e.clientY - touchStartPos.y
      if (dx * dx + dy * dy > TOUCH_DRAG_THRESHOLD * TOUCH_DRAG_THRESHOLD) {
        cancelLongPress()
        touchState = 'one_drag'

        // Determine drag behavior based on mode and pick
        const m = mode.value
        if (touchDragPick && (m === 'move' || m === 'transform')) {
          // Drag on mesh → translate
          dragging = true
          if (scene.activeSelection.includes(touchDragPick.nodeId)) {
            touchDragNodeIds = [...scene.activeSelection]
            dragNodeIds = touchDragNodeIds
          } else {
            touchDragNodeIds = [touchDragPick.nodeId]
            dragNodeIds = touchDragNodeIds
          }
          const node = scene.getNode(touchDragPick.nodeId)
          const operand = node?.operandId ? operands.get(node.operandId) : undefined
          if (operand) {
            const aabb = scene.getProperties(node!.operandId!)?.aabb as { data?: Float32Array } | undefined
            if (aabb?.data) {
              const d = aabb.data
              dragCenter = new THREE.Vector3((d[0]! + d[3]!) / 2, (d[1]! + d[4]!) / 2, (d[2]! + d[5]!) / 2)
            } else {
              dragCenter = touchDragPick.point.clone()
            }
          }
          const camDir = new THREE.Vector3()
          camera.getWorldDirection(camDir)
          movingPlane.setFromNormalAndCoplanarPoint(camDir, touchDragPick.point)
          updateNDCFromXY(e.clientX, e.clientY)
          raycaster.setFromCamera(ndc, camera)
          raycaster.ray.intersectPlane(movingPlane, lastPoint)
        } else {
          // Drag on empty → orbit
          dragging = true
          dragNodeIds = []
          dragPanning = false
          dragCenter = cameraTarget.clone()
        }

        lastPointerPos = { x: e.clientX, y: e.clientY }
      }
      return
    }

    if (touchState === 'one_drag') {
      updateNDCFromXY(e.clientX, e.clientY)
      if (dragNodeIds.length > 0) {
        handleTranslate()
      } else {
        // Orbit — reuse handleOrbit logic inline
        const dx = -(e.clientX - lastPointerPos.x)
        const dy = -(e.clientY - lastPointerPos.y)
        if (dx !== 0 || dy !== 0) {
          const transform = buildRotation(dx, dy, lastPointerPos.x, lastPointerPos.y, e.clientX, e.clientY, dragCenter!)
          camera.matrixAutoUpdate = false
          camera.matrix.premultiply(transform)
          camera.matrix.decompose(camera.position, camera.quaternion, camera.scale)
          camera.matrixAutoUpdate = true
          syncCamera()
          camera.updateProjectionMatrix()
          markCameraDirty()
        }
      }
      lastPointerPos = { x: e.clientX, y: e.clientY }
      return
    }

    if (touchState === 'two_finger' && touchPointers.size === 2) {
      const dist = touchPinchDist()
      const mid = touchMidpoint()

      // Zoom (pinch)
      if (touchPrevPinchDist > 0 && dist > 0) {
        const factor = dist / touchPrevPinchDist
        if (Math.abs(factor - 1) > 0.005) {
          zoomAtPoint(mid.x, mid.y, factor)
        }
      }

      // Pan (midpoint shift)
      const panDx = mid.x - touchPrevMidpoint.x
      const panDy = mid.y - touchPrevMidpoint.y
      if (Math.abs(panDx) > 0.5 || Math.abs(panDy) > 0.5) {
        // Pan: project midpoint shift to world space
        const camDir = new THREE.Vector3()
        camera.getWorldDirection(camDir)
        const panPlane = new THREE.Plane().setFromNormalAndCoplanarPoint(camDir, cameraTarget)

        updateNDCFromXY(touchPrevMidpoint.x, touchPrevMidpoint.y)
        raycaster.setFromCamera(ndc, camera)
        const prevWorld = new THREE.Vector3()
        raycaster.ray.intersectPlane(panPlane, prevWorld)

        updateNDCFromXY(mid.x, mid.y)
        raycaster.setFromCamera(ndc, camera)
        const currWorld = new THREE.Vector3()
        raycaster.ray.intersectPlane(panPlane, currWorld)

        const delta = prevWorld.sub(currWorld)
        camera.position.add(delta)
        cameraTarget.add(delta)
        camera.updateMatrixWorld()
        markCameraDirty()
      }

      touchPrevPinchDist = dist
      touchPrevMidpoint = mid
      return
    }
  }

  function onTouchPointerUp(e: PointerEvent) {
    touchPointers.delete(e.pointerId)
    try {
      container.releasePointerCapture(e.pointerId)
    } catch {}
    cancelLongPress()

    if (touchState === 'pending') {
      // Tap
      const now = Date.now()
      const elapsed = now - touchStartTime
      if (elapsed < LONG_PRESS_MS) {
        if (now - touchLastTapTime < DOUBLE_TAP_MS) {
          // Double tap
          touchLastTapTime = 0
          updateNDCFromXY(touchStartPos.x, touchStartPos.y)
          const hit = pick()
          if (hit) {
            fitToNodes([hit.nodeId])
          } else {
            fitToScene()
          }
        } else {
          // Single tap — select
          touchLastTapTime = now
          updateNDCFromXY(touchStartPos.x, touchStartPos.y)
          const hit = pick()
          if (hit) {
            scene.handleSelect(hit.nodeId, false)
          } else {
            scene.clearSelection()
          }
        }
      }
    }

    if (touchState === 'one_drag' && dragging) {
      dragging = false
      dragNodeIds = []
      touchDragNodeIds = []
      dragCenter = null
      dragPanning = false
    }

    if (touchPointers.size === 0) {
      touchState = 'none'
      touchDragPick = null
    } else if (touchPointers.size === 1 && touchState === 'two_finger') {
      // Transition: continue as one-finger orbit
      touchState = 'one_drag'
      dragging = true
      dragNodeIds = []
      dragPanning = false
      dragCenter = cameraTarget.clone()
      const remaining = [...touchPointers.values()][0]!
      lastPointerPos = { x: remaining.x, y: remaining.y }
    }
  }

  // ── Key handlers ──────────────────────────────────────────

  function onKeyDown(e: KeyboardEvent) {
    const tag = (e.target as HTMLElement)?.tagName
    if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return
    const key = e.key.toLowerCase()
    keysDown.add(key)

    // Sticky mode: Shift + mode key
    if (e.shiftKey) {
      if (key === 't') toggleStickyTransform()
      else if (key === 'c') toggleStickyOrbit()
    }

    // N = return to normal (clear sticky + axis lock)
    if (key === 'n') {
      stickyMode.value = null
      lockedAxis.value = null
    }

    updateMode()
  }

  function onKeyUp(e: KeyboardEvent) {
    keysDown.delete(e.key.toLowerCase())
    updateMode()

    // When releasing T or C during drag, reset translate reference point
    if ((e.key === 't' || e.key === 'T' || e.key === 'c' || e.key === 'C') && dragging) {
      raycaster.setFromCamera(ndc, camera)
      raycaster.ray.intersectPlane(movingPlane, lastPoint)
    }
  }

  function onBlur() {
    keysDown.clear()
    stickyMode.value = null
    lockedAxis.value = null
    updateMode()
  }

  // ── Pointer handlers ──────────────────────────────────────

  let pointerDownButton = -1

  function onPointerDown(e: PointerEvent) {
    if (e.pointerType === 'touch') {
      onTouchPointerDown(e)
      return
    }
    if (e.button !== 0 && e.button !== 2) return
    pointerDownPos = { x: e.clientX, y: e.clientY }
    lastPointerPos = { x: e.clientX, y: e.clientY }
    pointerMoved = false
    pointerIsDown = true
    activePointerId = e.pointerId
    pointerDownButton = e.button
    updateNDC(e)
    pointerDownPick = e.button === 2 ? null : pick() // right-click never picks
    pointerDownShift = e.shiftKey
    maybeDrag = pointerDownPick !== null
  }

  function onPointerMove(e: PointerEvent) {
    if (e.pointerType === 'touch') {
      onTouchPointerMove(e)
      return
    }
    updateNDC(e)
    const pdx = e.clientX - pointerDownPos.x
    const pdy = e.clientY - pointerDownPos.y
    const pastThreshold = pdx * pdx + pdy * pdy > DRAG_THRESHOLD * DRAG_THRESHOLD
    if (pastThreshold) pointerMoved = true

    // Active drag
    if (dragging) {
      const m = mode.value
      if (dragNodeIds.length === 0) {
        // Camera drag (no meshes in drag set)
        if (dragPanning) {
          handleCameraPan(e)
        } else {
          handleOrbit(e)
        }
      } else if (m === 'orbit') {
        handleOrbit(e)
      } else if (m === 'transform') {
        handleRotate(e)
      } else {
        handleTranslate()
      }
      lastPointerPos = { x: e.clientX, y: e.clientY }
      return
    }

    // Hover
    if (!pointerIsDown) {
      const hover = pick()
      scene.hoveredNode.value = hover?.nodeId ?? null
    }

    // C+drag on empty space (orbit camera around cursor)
    if (pointerIsDown && !maybeDrag && pastThreshold && !pointerDownPick && mode.value === 'orbit') {
      const sceneCenter = getInViewCenter()
      if (sceneCenter) {
        dragging = true
        container.setPointerCapture(activePointerId)

        const camDir = new THREE.Vector3()
        camera.getWorldDirection(camDir)
        const plane = new THREE.Plane().setFromNormalAndCoplanarPoint(camDir, sceneCenter)

        raycaster.setFromCamera(ndc, camera)
        const hit = new THREE.Vector3()
        raycaster.ray.intersectPlane(plane, hit)
        dragCenter = hit
        dragNodeIds = []
      }
      return
    }

    // T+drag on empty space (rotate selection around cursor) — only if selection exists
    if (
      pointerIsDown &&
      !maybeDrag &&
      pastThreshold &&
      !pointerDownPick &&
      mode.value === 'transform' &&
      scene.activeSelection.length > 0
    ) {
      const sceneCenter = getInViewCenter()
      if (sceneCenter) {
        dragging = true
        container.setPointerCapture(activePointerId)

        const camDir = new THREE.Vector3()
        camera.getWorldDirection(camDir)
        const plane = new THREE.Plane().setFromNormalAndCoplanarPoint(camDir, sceneCenter)

        raycaster.setFromCamera(ndc, camera)
        const hit = new THREE.Vector3()
        raycaster.ray.intersectPlane(plane, hit)
        dragCenter = hit
        dragNodeIds = [...scene.activeSelection]
      }
      return
    }

    // Move-mode drag on empty space: orbit camera around cameraTarget, or shift+drag to pan
    if (pointerIsDown && !maybeDrag && pastThreshold && !pointerDownPick && mode.value === 'move') {
      dragging = true
      container.setPointerCapture(activePointerId)
      dragPanning = pointerDownShift || pointerDownButton === 2
      dragCenter = cameraTarget.clone()
      dragNodeIds = []

      // For pan: set up the plane
      if (dragPanning) {
        const camDir = new THREE.Vector3()
        camera.getWorldDirection(camDir)
        movingPlane.setFromNormalAndCoplanarPoint(camDir, cameraTarget)
        raycaster.setFromCamera(ndc, camera)
        raycaster.ray.intersectPlane(movingPlane, lastPoint)
      }
      return
    }

    // Drag on mesh
    if (maybeDrag && pointerDownPick && pastThreshold) {
      dragging = true
      container.setPointerCapture(activePointerId)

      if (scene.activeSelection.includes(pointerDownPick.nodeId)) {
        dragNodeIds = [...scene.activeSelection]
      } else {
        dragNodeIds = [pointerDownPick.nodeId]
      }

      // Pivot is the clicked mesh's center, not the combined center
      dragCenter = getWorldCenter(pointerDownPick.nodeId)

      const camDir = new THREE.Vector3()
      camera.getWorldDirection(camDir)
      movingPlane.setFromNormalAndCoplanarPoint(camDir, pointerDownPick.point)
      lastPoint.copy(pointerDownPick.point)
      return
    }
  }

  function onPointerUp(e: PointerEvent) {
    if (e.pointerType === 'touch') {
      onTouchPointerUp(e)
      return
    }
    if (dragging) return
    if (maybeDrag && pointerDownPick) {
      const add = e.shiftKey || e.metaKey || e.ctrlKey
      scene.handleSelect(pointerDownPick.nodeId, add)
    } else if (!pointerDownPick && !pointerMoved) {
      scene.clearSelection()
    }

    pointerIsDown = false
    maybeDrag = false
    pointerDownPick = null
    pointerDownButton = -1
    activePointerId = -1
  }

  function onDragEnd() {
    if (!dragging) return
    if (activePointerId !== -1) {
      try {
        container.releasePointerCapture(activePointerId)
      } catch {}
    }
    dragging = false
    dragNodeIds = []
    dragCenter = null
    dragPanning = false
    pointerIsDown = false
    maybeDrag = false
    pointerDownPick = null
    activePointerId = -1
  }

  // ── Translate ─────────────────────────────────────────────

  function handleTranslate() {
    raycaster.setFromCamera(ndc, camera)
    const nextPoint = new THREE.Vector3()
    raycaster.ray.intersectPlane(movingPlane, nextPoint)
    if (!nextPoint) return

    let dx = nextPoint.x - lastPoint.x
    let dy = nextPoint.y - lastPoint.y
    let dz = nextPoint.z - lastPoint.z
    lastPoint.copy(nextPoint)

    // Axis lock: zero the component along the locked axis so the mesh
    // only moves in the perpendicular plane (e.g. Y locked → XZ only).
    if (lockedAxis.value === 'X') dx = 0
    else if (lockedAxis.value === 'Y') dy = 0
    else if (lockedAxis.value === 'Z') dz = 0

    for (const nodeId of dragNodeIds) {
      const node = scene.getNode(nodeId)
      if (!node?.operandId) continue
      const operand = operands.get(node.operandId)
      if (!operand) continue

      const tfObj = operand.data as any
      let mat = tfObj.transformation
      if (!mat) {
        mat = tf.ndarray(new Float32Array([1, 0, 0, dx, 0, 1, 0, dy, 0, 0, 1, dz, 0, 0, 0, 1])).reshape([4, 4])
        tfObj.transformation = mat
        mat.delete()
      } else {
        const d = mat.data
        d[3] += dx
        d[7] += dy
        d[11] += dz
        tfObj.transformation = mat
        mat.delete()
      }

      scene.dirty.add(nodeId)
    }
  }

  // ── Rotate ────────────────────────────────────────────────

  function getWorldCenter(nodeId: string): THREE.Vector3 | null {
    const node = scene.getNode(nodeId)
    if (!node?.operandId) return null
    const operand = operands.get(node.operandId)
    if (!operand) return null

    const tfObj = operand.data as any
    const mat = tfObj.transformation
    const m = new THREE.Matrix4()
    if (mat) {
      m.fromArray(mat.data).transpose()
      mat.delete()
    }

    const aabb = scene.getProperties(node.operandId)?.aabb as any
    if (aabb) {
      const d = aabb.data as Float32Array
      return new THREE.Vector3((d[0]! + d[3]!) / 2, (d[1]! + d[4]!) / 2, (d[2]! + d[5]!) / 2).applyMatrix4(m)
    }
    return new THREE.Vector3().setFromMatrixPosition(m)
  }

  function getInViewCenter(): THREE.Vector3 | null {
    const frustum = new THREE.Frustum()
    frustum.setFromProjectionMatrix(new THREE.Matrix4().multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse))
    const box = new THREE.Box3()
    const objBox = new THREE.Box3()
    const threeScene = camera.parent!
    threeScene.traverse((child) => {
      if (child instanceof THREE.Mesh && child.visible) {
        objBox.setFromObject(child)
        if (frustum.intersectsBox(objBox)) box.union(objBox)
      }
    })
    if (box.isEmpty()) return null
    return box.getCenter(new THREE.Vector3())
  }

  function getCombinedCenter(nodeIds: string[]): THREE.Vector3 | null {
    const center = new THREE.Vector3()
    let count = 0
    for (const nodeId of nodeIds) {
      const c = getWorldCenter(nodeId)
      if (c) {
        center.add(c)
        count++
      }
    }
    if (count === 0) return null
    return center.divideScalar(count)
  }

  const AXIS_VECTORS: Record<string, THREE.Vector3> = {
    X: new THREE.Vector3(1, 0, 0),
    Y: new THREE.Vector3(0, 1, 0),
    Z: new THREE.Vector3(0, 0, 1),
  }

  /**
   * Build a rotation matrix around `center`.
   *
   * @param dx        Signed screen-space horizontal delta (pixels)
   * @param dy        Signed screen-space vertical delta (pixels)
   * @param screenX   Real current mouse X (for depth-component angular calc)
   * @param screenY   Real current mouse Y
   * @param prevX     Real previous mouse X
   * @param prevY     Real previous mouse Y
   * @param center    World-space pivot
   */
  function buildRotation(
    dx: number,
    dy: number,
    screenX: number,
    screenY: number,
    prevX: number,
    prevY: number,
    center: THREE.Vector3,
  ) {
    const toOrigin = new THREE.Matrix4().makeTranslation(-center.x, -center.y, -center.z)
    const fromOrigin = new THREE.Matrix4().makeTranslation(center.x, center.y, center.z)

    if (lockedAxis.value) {
      const axis = AXIS_VECTORS[lockedAxis.value]!
      const right = new THREE.Vector3(1, 0, 0).applyQuaternion(camera.quaternion)
      const up = new THREE.Vector3(0, 1, 0).applyQuaternion(camera.quaternion)
      const forward = new THREE.Vector3(0, 0, -1).applyQuaternion(camera.quaternion)
      const sz = axis.dot(forward)

      // Use the camera-facing direction of the axis so that drag direction
      // is always visually consistent regardless of which end faces the camera.
      // When the axis points away (sz < 0), flip it so the tangent computation
      // uses the front-facing projection.
      const facing = sz >= 0 ? 1 : -1
      const sx = axis.dot(right) * facing
      const sy = axis.dot(up) * facing

      // Tangent: perpendicular to the axis's screen projection
      const angleTangent = (dx * sy - dy * sx) * 0.5

      // Depth: angular change of the real mouse position around the
      // projected pivot (like spinning a wheel when looking down the axis).
      // Always positive sz after facing flip, so use absolute value.
      let angleDepth = 0
      const absSz = Math.abs(sz)
      if (absSz > 0.01) {
        const proj = center.clone().project(camera)
        const cx = (proj.x + 1) * 0.5 * container.clientWidth
        const cy = (1 - proj.y) * 0.5 * container.clientHeight

        const px = prevX - cx
        const py = -(prevY - cy)
        const nx = screenX - cx
        const ny = -(screenY - cy)

        const cross2d = px * ny - py * nx
        const dot2d = px * nx + py * ny
        if (px * px + py * py > 1 && nx * nx + ny * ny > 1) {
          const screenAngle = Math.atan2(cross2d, dot2d) * (180 / Math.PI)
          angleDepth = absSz * screenAngle * facing
        }
      }

      const angle = angleTangent + angleDepth
      const rot = new THREE.Matrix4().makeRotationAxis(axis, THREE.MathUtils.degToRad(angle))
      return new THREE.Matrix4().multiply(fromOrigin).multiply(rot).multiply(toOrigin)
    }

    // Free trackball: rotate around camera right (dy) and camera up (dx).
    const angleX = dy * 0.5
    const angleY = dx * 0.5
    const right = new THREE.Vector3(1, 0, 0).applyQuaternion(camera.quaternion)
    const up = new THREE.Vector3(0, 1, 0).applyQuaternion(camera.quaternion)
    const rotX = new THREE.Matrix4().makeRotationAxis(right, THREE.MathUtils.degToRad(angleX))
    const rotY = new THREE.Matrix4().makeRotationAxis(up, THREE.MathUtils.degToRad(angleY))
    return new THREE.Matrix4().multiply(fromOrigin).multiply(rotY).multiply(rotX).multiply(toOrigin)
  }

  function handleRotate(e: PointerEvent) {
    if (!dragCenter) return
    const dx = e.clientX - lastPointerPos.x
    const dy = e.clientY - lastPointerPos.y
    const transform = buildRotation(dx, dy, e.clientX, e.clientY, lastPointerPos.x, lastPointerPos.y, dragCenter)

    for (const nodeId of dragNodeIds) {
      const node = scene.getNode(nodeId)
      if (!node?.operandId) continue
      const operand = operands.get(node.operandId)
      if (!operand) continue

      const tfObj = operand.data as any
      const mat = tfObj.transformation
      const m = new THREE.Matrix4()
      if (mat) {
        m.fromArray(mat.data).transpose()
        mat.delete()
      }

      const newMatrix = transform.clone().multiply(m)

      const rm = newMatrix.clone().transpose()
      const newMat = tf.ndarray(new Float32Array(rm.toArray())).reshape([4, 4])
      tfObj.transformation = newMat
      newMat.delete()

      scene.dirty.add(nodeId)
    }
  }

  // ── Orbit camera ──────────────────────────────────────────

  function handleOrbit(e: PointerEvent) {
    if (!dragCenter) return
    // Negate dx/dy so camera moves opposite to drag (natural orbiting).
    // Real screen positions are passed unchanged for the depth-component
    // angular calculation; its sign is handled by negating the total
    // angle via the negated dx/dy in the tangent term — and for the depth
    // term we swap prev/current positions to reverse the angular direction.
    const dx = -(e.clientX - lastPointerPos.x)
    const dy = -(e.clientY - lastPointerPos.y)
    const transform = buildRotation(dx, dy, lastPointerPos.x, lastPointerPos.y, e.clientX, e.clientY, dragCenter)

    camera.matrixAutoUpdate = false
    camera.matrix.premultiply(transform)
    camera.matrix.decompose(camera.position, camera.quaternion, camera.scale)
    camera.matrixAutoUpdate = true
    camera.updateMatrix()
    syncCamera()
    camera.updateProjectionMatrix()
    markCameraDirty()
  }

  // ── Pan camera ──────────────────────────────────────────────

  function handleCameraPan(e: PointerEvent) {
    raycaster.setFromCamera(ndc, camera)
    const nextPoint = new THREE.Vector3()
    raycaster.ray.intersectPlane(movingPlane, nextPoint)
    if (!nextPoint) return

    const delta = new THREE.Vector3().subVectors(lastPoint, nextPoint)
    camera.position.add(delta)
    cameraTarget.add(delta)
    camera.updateMatrixWorld()
    markCameraDirty()

    // Re-intersect for next frame (plane moved with camera)
    raycaster.setFromCamera(ndc, camera)
    raycaster.ray.intersectPlane(movingPlane, lastPoint)
  }

  // ── Transform-mode scale (wheel) ──────────────────────────
  //
  // Wired from useViewport's wheel handler. Only consumes the event when:
  //   - Transform (T) mode is active
  //   - there is at least one selected mesh
  //   - we're not currently dragging
  //
  // Each mesh scales uniformly around its own world-space center. Sensitivity
  // matches the camera zoom (`factor > 1` on wheel-up = grow).

  function handleScaleSelection(_event: WheelEvent, factor: number): boolean {
    if (mode.value !== 'transform') return false
    if (dragging) return false
    const nodeIds = [...scene.activeSelection]
    if (nodeIds.length === 0) return false

    for (const nodeId of nodeIds) {
      const node = scene.getNode(nodeId)
      if (!node?.operandId) continue
      const operand = operands.get(node.operandId)
      if (!operand) continue

      // Read the mesh's current transformation.
      const tfObj = operand.data as { transformation: tf.NDArrayFloat32 | null }
      const mat = tfObj.transformation
      const m = new THREE.Matrix4()
      if (mat) {
        m.fromArray(mat.data).transpose()
        mat.delete()
      }

      // Pivot = mesh's own world-space center (AABB midpoint).
      const center = getWorldCenter(nodeId) ?? new THREE.Vector3().setFromMatrixPosition(m)

      // Build scale around center: Translate(c) * Scale(f) * Translate(-c)
      const toOrigin = new THREE.Matrix4().makeTranslation(-center.x, -center.y, -center.z)
      const fromOrigin = new THREE.Matrix4().makeTranslation(center.x, center.y, center.z)
      // Axis-locked: non-uniform scale along one axis. Unlocked: uniform.
      const fx = !lockedAxis.value || lockedAxis.value === 'X' ? factor : 1
      const fy = !lockedAxis.value || lockedAxis.value === 'Y' ? factor : 1
      const fz = !lockedAxis.value || lockedAxis.value === 'Z' ? factor : 1
      const scaleMat = new THREE.Matrix4().makeScale(fx, fy, fz)
      const transform = new THREE.Matrix4().multiply(fromOrigin).multiply(scaleMat).multiply(toOrigin)

      const newMatrix = transform.multiply(m)
      const rm = newMatrix.clone().transpose()
      const newMat = tf.ndarray(new Float32Array(rm.toArray())).reshape([4, 4]) as tf.NDArrayFloat32
      tfObj.transformation = newMat
      newMat.delete()

      scene.dirty.add(nodeId)
    }

    return true
  }

  // ── Rotate selection 90° (axes widget click in Transform mode) ────────

  function rotateSelection90(axis: 'X' | 'Y' | 'Z') {
    const nodeIds = [...scene.activeSelection]
    if (nodeIds.length === 0) return

    const axisVec = AXIS_VECTORS[axis]!
    const angle = -Math.PI / 2 // negative to match camera rotation direction visually

    for (const nodeId of nodeIds) {
      const node = scene.getNode(nodeId)
      if (!node?.operandId) continue
      const operand = operands.get(node.operandId)
      if (!operand) continue

      const tfObj = operand.data as { transformation: tf.NDArrayFloat32 | null }
      const mat = tfObj.transformation
      const m = new THREE.Matrix4()
      if (mat) {
        m.fromArray(mat.data).transpose()
        mat.delete()
      }

      const center = getWorldCenter(nodeId) ?? new THREE.Vector3().setFromMatrixPosition(m)

      const toOrigin = new THREE.Matrix4().makeTranslation(-center.x, -center.y, -center.z)
      const fromOrigin = new THREE.Matrix4().makeTranslation(center.x, center.y, center.z)
      const rot = new THREE.Matrix4().makeRotationAxis(axisVec, angle)
      const transform = new THREE.Matrix4().multiply(fromOrigin).multiply(rot).multiply(toOrigin)

      const newMatrix = transform.multiply(m)
      const rm = newMatrix.clone().transpose()
      const newMat = tf.ndarray(new Float32Array(rm.toArray())).reshape([4, 4]) as tf.NDArrayFloat32
      tfObj.transformation = newMat
      newMat.delete()

      scene.dirty.add(nodeId)
    }
  }

  // ── Bind / unbind ─────────────────────────────────────────

  container.addEventListener('pointerdown', onPointerDown)
  container.addEventListener('pointermove', onPointerMove)
  container.addEventListener('pointerup', onPointerUp)
  container.addEventListener('pointercancel', onTouchPointerUp)
  container.addEventListener('contextmenu', onContextMenu)
  window.addEventListener('pointerup', onDragEnd)
  window.addEventListener('keydown', onKeyDown)
  window.addEventListener('keyup', onKeyUp)
  window.addEventListener('blur', onBlur)

  function dispose() {
    container.removeEventListener('pointerdown', onPointerDown)
    container.removeEventListener('pointermove', onPointerMove)
    container.removeEventListener('pointerup', onPointerUp)
    container.removeEventListener('pointercancel', onTouchPointerUp)
    container.removeEventListener('pointerenter', onPointerEnter)
    container.removeEventListener('pointerleave', onPointerLeave)
    container.removeEventListener('contextmenu', onContextMenu)
    window.removeEventListener('pointerup', onDragEnd)
    window.removeEventListener('keydown', onKeyDown)
    window.removeEventListener('keyup', onKeyUp)
    window.removeEventListener('blur', onBlur)
  }

  return {
    mode,
    stickyMode,
    lockedAxis,
    handleScaleSelection,
    clearStickyMode,
    toggleStickyTransform,
    toggleStickyOrbit,
    setAxisLock,
    clearAxisLock,
    rotateSelection90,
    dispose,
  }
}
