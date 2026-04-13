import { shallowRef, triggerRef } from 'vue'

/**
 * Reactive camera rotation snapshot (row-major 3×3 Float32Array).
 *
 * Updated by the viewport each frame via `updateCameraRotation()`.
 * Consumers:
 *   - AxesWidget: reactively re-renders the SVG triad when the camera rotates
 *   - align-to-frame operator: reads `cameraRotation.value` for camera-target alignment
 *
 * Uses `shallowRef` + in-place mutation + `triggerRef()` to avoid allocating
 * a new Float32Array 60 times/sec.
 */
export const cameraRotation = shallowRef<Float32Array>(new Float32Array([1, 0, 0, 0, 1, 0, 0, 0, 1]))

/**
 * Extract the 3×3 rotation from a Three.js Matrix4 (column-major elements)
 * and store row-major with rows = [camera right, camera up, camera Z].
 *
 * Row 0 = camera right (matrixWorld column 0)
 * Row 1 = camera up    (matrixWorld column 1)
 * Row 2 = camera Z     (matrixWorld column 2, backward direction)
 *
 * This lets consumers index by world axis: for axis col (X=0,Y=1,Z=2),
 * screen_x = r[col], screen_y = r[col+3], depth = r[col+6].
 */
export function updateCameraRotation(elements: ArrayLike<number>) {
  const r = cameraRotation.value
  // Row 0: camera right (column 0 of matrixWorld)
  r[0] = elements[0]!
  r[1] = elements[1]!
  r[2] = elements[2]!
  // Row 1: camera up (column 1 of matrixWorld)
  r[3] = elements[4]!
  r[4] = elements[5]!
  r[5] = elements[6]!
  // Row 2: camera Z (column 2 of matrixWorld)
  r[6] = elements[8]!
  r[7] = elements[9]!
  r[8] = elements[10]!
  triggerRef(cameraRotation)
}
