import * as tf from '@polydera/trueform'
import { operators } from '../registry'
import { getCachedPointCloud } from '../operands'
import { copyTransform } from '../utils'
import { cameraRotation } from '@/viewport/cameraState'

operators.register({
  id: 'tf.alignMeshes',
  label: 'Align Meshes',
  description:
    'Register source mesh to target mesh using OBB coarse alignment followed by ICP refinement. Applies the transform to the source mesh.',
  category: 'align',
  tags: ['align', 'register', 'icp', 'obb', 'registration'],
  docsUrl: 'https://trueform.polydera.com/ts/modules/geometry#coarse-alignment',
  expensive: true,
  inputs: [
    { name: 'source', label: 'Source', type: 'mesh', description: 'Mesh to align' },
    { name: 'target', label: 'Target', type: 'mesh', description: 'Reference mesh' },
    {
      name: 'maxIterations',
      label: 'Max Iterations',
      type: 'number',
      description: 'ICP maximum iterations',
      optional: true,
      default: 50,
      min: 1,
      max: 500,
      step: 1,
    },
    {
      name: 'nSamples',
      label: 'Samples',
      type: 'number',
      description: 'Points sampled per ICP iteration (0 = all)',
      optional: true,
      default: 1000,
      min: 0,
      step: 100,
    },
  ],
  outputs: [],
  sync: ({ source, target, maxIterations, nSamples }) => {
    const sourceMesh = source as tf.Mesh
    const targetMesh = target as tf.Mesh
    const sourcePC = tf.pointCloud(sourceMesh)
    const targetPC = tf.pointCloud(targetMesh)

    // Copy transformations from meshes to point clouds
    copyTransform(sourceMesh, sourcePC)
    copyTransform(targetMesh, targetPC)
    targetPC.buildTree()

    // Read current source transform for composing
    const T_current = sourceMesh.transformation

    // Stage 1: OBB coarse alignment (returns delta)
    const T_obb = tf.fitObbAlignment(sourcePC, targetPC)

    // Compose: afterObb = delta_obb * current
    const T_afterObb = T_current ? T_obb.matMul(T_current) : T_obb
    sourcePC.transformation = T_afterObb

    // Stage 2: ICP refinement (returns delta from current pose)
    const T_icp = tf.fitIcpAlignment(sourcePC, targetPC, {
      maxIterations: maxIterations as number,
      nSamples: nSamples as number,
    })

    // Compose: final = delta_icp * afterObb
    const T_final = T_icp.matMul(T_afterObb)
    sourceMesh.transformation = T_final

    // Cleanup
    if (T_current) T_current.delete()
    T_obb.delete()
    if (T_current) T_afterObb.delete()
    T_icp.delete()
    T_final.delete()
    sourcePC.delete()
    targetPC.delete()

    return {}
  },
  async: async ({ source, target, maxIterations, nSamples }) => {
    const sourceMesh = source as tf.Mesh
    const targetMesh = target as tf.Mesh
    // Cached point clouds: tree built once per mesh, reused across runs.
    // Disposed automatically when the source mesh operand is removed.
    const sourcePC = await getCachedPointCloud(sourceMesh)
    const targetPC = await getCachedPointCloud(targetMesh)

    // Refresh transforms — the user may have moved meshes since the last call.
    copyTransform(sourceMesh, sourcePC)
    copyTransform(targetMesh, targetPC)

    const T_current = sourceMesh.transformation

    const T_obb = await tf.async.fitObbAlignment(sourcePC, targetPC)

    const T_afterObb = T_current ? T_obb.matMul(T_current) : T_obb
    sourcePC.transformation = T_afterObb

    const T_icp = await tf.async.fitIcpAlignment(sourcePC, targetPC, {
      maxIterations: maxIterations as number,
      nSamples: nSamples as number,
    })

    const T_final = T_icp.matMul(T_afterObb)
    sourceMesh.transformation = T_final

    if (T_current) T_current.delete()
    T_obb.delete()
    if (T_current) T_afterObb.delete()
    T_icp.delete()
    T_final.delete()
    // Note: do NOT delete sourcePC/targetPC — they're cached and shared.

    return {}
  },
})

// ── Align to Frame ────────────────────────────────────────────────────────
//
// Rotates a mesh so its OBB axes align with a reference frame (world or camera).
// Pivot is the OBB center. No translation — pure reorientation.
//
// trueform returns: { origin: NDArrayFloat32 [3], axes: NDArrayFloat32 [3,3], extent: NDArrayFloat32 [3] }
//   origin = min corner of the OBB
//   axes   = 3 normalized direction vectors (rows), one per extent
//   extent = lengths along each axis
//
// OBB center = origin + 0.5 * (axes[0]*extent[0] + axes[1]*extent[1] + axes[2]*extent[2])
//
// The `upAxis` param picks which OBB extent (shortest / middle / longest) maps to the
// target Y. The remaining two auto-assign to X (next-longest) and Z.
//
// Rotation R: columns = [obbRight, obbUp, obbFwd] → world [X, Y, Z].
// For world target: R = M_obb^T (since M_target = I and OBB axes are orthonormal).
// Applied around center: T(center) * R * T(-center) * T_current.

type UpAxis = 'shortest' | 'middle' | 'longest'

/** Given 3 extents, return indices sorted [longest, middle, shortest]. */
function sortedExtentIndices(ext: Float32Array): [number, number, number] {
  const indexed: [number, number][] = [
    [ext[0]!, 0],
    [ext[1]!, 1],
    [ext[2]!, 2],
  ]
  indexed.sort((a, b) => b[0] - a[0]) // descending by extent
  return [indexed[0]![1], indexed[1]![1], indexed[2]![1]]
}

/**
 * Build the alignment transform and apply it to the mesh.
 *
 * Strategy: REPLACE the transformation (not compose). The new transformation
 * is R (rotation mapping local OBB axes → target frame) + a translation that
 * preserves the mesh's current world-space center. Idempotent: local points
 * never change, so running twice gives the same result.
 *
 * For target='world': R maps OBB axes → world XYZ.
 * For target='camera': R maps OBB axes → camera right/up/forward (= C * R_world
 *   where C is the camera's world rotation read from the shared cameraState).
 *
 * Preserves any existing scale in the transformation.
 */
function applyAlignToFrame(m: tf.Mesh, obb: tf.OBB, up: UpAxis, target: string): void {
  // 1. Compute local OBB center
  const halfExtent = obb.extent.mul(0.5) as tf.NDArrayFloat32
  const offsetVec = halfExtent.unsqueeze(0).matMul(obb.axes).squeeze(0) as tf.NDArrayFloat32
  const localCenter = obb.origin.add(offsetVec) as tf.NDArrayFloat32
  const lc = localCenter.data as Float32Array

  // 2. Compute current world center
  const oldT = m.transformation
  let wcx: number, wcy: number, wcz: number
  if (oldT) {
    const d = oldT.data as Float32Array
    wcx = d[0]! * lc[0]! + d[1]! * lc[1]! + d[2]! * lc[2]! + d[3]!
    wcy = d[4]! * lc[0]! + d[5]! * lc[1]! + d[6]! * lc[2]! + d[7]!
    wcz = d[8]! * lc[0]! + d[9]! * lc[1]! + d[10]! * lc[2]! + d[11]!
  } else {
    wcx = lc[0]!
    wcy = lc[1]!
    wcz = lc[2]!
  }

  // 3. Extract scale from existing transformation (row norms in row-major)
  let sx = 1,
    sy = 1,
    sz = 1
  if (oldT) {
    const d = oldT.data as Float32Array
    sx = Math.sqrt(d[0]! ** 2 + d[1]! ** 2 + d[2]! ** 2)
    sy = Math.sqrt(d[4]! ** 2 + d[5]! ** 2 + d[6]! ** 2)
    sz = Math.sqrt(d[8]! ** 2 + d[9]! ** 2 + d[10]! ** 2)
  }

  // 4. Sort extents, pick axis mapping
  const [iLong, iMid, iShort] = sortedExtentIndices(obb.extent.data as Float32Array)
  const upIdx = up === 'longest' ? iLong : up === 'middle' ? iMid : iShort
  const remaining = [iLong, iMid, iShort].filter((i) => i !== upIdx)
  const rightIdx = remaining[0]!
  const fwdIdx = remaining[1]!

  // 5. Build R_world: maps local OBB axes → world XYZ.
  //    Rows = re-ordered OBB axes [right, up, fwd].
  const ad = obb.axes.data as Float32Array
  let r00 = ad[rightIdx * 3]!,
    r01 = ad[rightIdx * 3 + 1]!,
    r02 = ad[rightIdx * 3 + 2]!
  let r10 = ad[upIdx * 3]!,
    r11 = ad[upIdx * 3 + 1]!,
    r12 = ad[upIdx * 3 + 2]!
  let r20 = ad[fwdIdx * 3]!,
    r21 = ad[fwdIdx * 3 + 1]!,
    r22 = ad[fwdIdx * 3 + 2]!

  // 6. For camera target: R_final = C * R_world (rotate world-aligned → camera-aligned)
  if (target === 'camera') {
    const c = cameraRotation.value // rows = [right, up, camZ]
    // Read transposed: columns of c become rows of C for the multiplication
    const c00 = c[0]!,
      c01 = c[3]!,
      c02 = c[6]!
    const c10 = c[1]!,
      c11 = c[4]!,
      c12 = c[7]!
    const c20 = c[2]!,
      c21 = c[5]!,
      c22 = c[8]!

    const n00 = c00 * r00 + c01 * r10 + c02 * r20
    const n01 = c00 * r01 + c01 * r11 + c02 * r21
    const n02 = c00 * r02 + c01 * r12 + c02 * r22
    const n10 = c10 * r00 + c11 * r10 + c12 * r20
    const n11 = c10 * r01 + c11 * r11 + c12 * r21
    const n12 = c10 * r02 + c11 * r12 + c12 * r22
    const n20 = c20 * r00 + c21 * r10 + c22 * r20
    const n21 = c20 * r01 + c21 * r11 + c22 * r21
    const n22 = c20 * r02 + c21 * r12 + c22 * r22

    r00 = n00
    r01 = n01
    r02 = n02
    r10 = n10
    r11 = n11
    r12 = n12
    r20 = n20
    r21 = n21
    r22 = n22
  }

  // 7. Translation to preserve world center: t = wc - S*R * lc
  const tx = wcx - sx * (r00 * lc[0]! + r01 * lc[1]! + r02 * lc[2]!)
  const ty = wcy - sy * (r10 * lc[0]! + r11 * lc[1]! + r12 * lc[2]!)
  const tz = wcz - sz * (r20 * lc[0]! + r21 * lc[1]! + r22 * lc[2]!)

  // 8. Build the 4×4 row-major: [S*R | t; 0 0 0 1]
  const mat4Data = new Float32Array([
    sx * r00,
    sx * r01,
    sx * r02,
    tx,
    sy * r10,
    sy * r11,
    sy * r12,
    ty,
    sz * r20,
    sz * r21,
    sz * r22,
    tz,
    0,
    0,
    0,
    1,
  ])

  const newT = tf.ndarray(mat4Data, [4, 4]) as tf.NDArrayFloat32
  m.transformation = newT

  // Cleanup
  newT.delete()
  if (oldT) oldT.delete()
  localCenter.delete()
  offsetVec.delete()
  halfExtent.delete()
  obb.origin.delete()
  obb.axes.delete()
  obb.extent.delete()
}

operators.register({
  id: 'tf.alignToFrame',
  label: 'Align to Frame',
  description: 'Rotate a mesh so its oriented bounding box aligns to the world coordinate axes.',
  category: 'align',
  tags: ['align', 'obb', 'frame', 'orientation', 'world'],
  docsUrl: 'https://trueform.polydera.com/ts/modules/core#oriented-bounding-box',
  inputs: [
    { name: 'mesh', label: 'Mesh', type: 'mesh', description: 'Mesh to orient' },
    {
      name: 'target',
      label: 'Target',
      type: 'string',
      description: 'Reference frame to align to',
      enum: ['world', 'camera'],
      default: 'world',
    },
    {
      name: 'upAxis',
      label: 'Up Axis',
      type: 'string',
      description: 'Which OBB extent maps to the Y (up) direction',
      enum: ['shortest', 'middle', 'longest'],
      default: 'shortest',
    },
  ],
  outputs: [],
  sync: ({ mesh, target, upAxis }) => {
    const m = mesh as tf.Mesh
    const obb = tf.obbFrom(m)
    applyAlignToFrame(m, obb, upAxis as UpAxis, target as string)
    return {}
  },
  async: async ({ mesh, target, upAxis }) => {
    const m = mesh as tf.Mesh
    const obb = await tf.async.obbFrom(m)
    applyAlignToFrame(m, obb, upAxis as UpAxis, target as string)
    return {}
  },
})
