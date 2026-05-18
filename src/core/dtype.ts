import * as tf from '@polydera/trueform'
import { operands } from './operands'
import { prefs } from '@/composables/usePreferences'

export type FloatDtype = 'float32' | 'float64'

/** Build a 4x4 row-major matrix in the same dtype as the target object. */
export function matrixFor(
  obj: { dtype: FloatDtype },
  arr: number[] | ArrayLike<number>,
): tf.NDArrayFloat32 | tf.NDArrayFloat64 {
  return obj.dtype === 'float64'
    ? tf.ndarray(new Float64Array(arr)).reshape([4, 4])
    : tf.ndarray(new Float32Array(arr)).reshape([4, 4])
}

/**
 * Convert a mesh to the requested dtype in place, replacing the operand's
 * stored data. Preserves the transformation matrix in matching dtype.
 * Returns the new mesh (same operand id, new wasm handle).
 */
export function convertMeshDtype(operandId: string, target: FloatDtype): tf.Mesh {
  const operand = operands.get(operandId)
  if (!operand || operand.type !== 'mesh') throw new Error(`Not a mesh operand: ${operandId}`)
  const mesh = operand.data as tf.Mesh
  if (mesh.dtype === target) return mesh

  const faces = mesh.faces
  const pointsTarget = mesh.points.as(target)
  const oldT = mesh.transformation
  const newMesh = tf.mesh(faces, pointsTarget)
  if (oldT) {
    newMesh.transformation = oldT.as(target) as tf.NDArrayFloat32 | tf.NDArrayFloat64
    oldT.delete()
  }
  faces.delete()
  pointsTarget.delete()
  mesh.delete()
  operands.replaceData(operandId, newMesh)
  return newMesh
}

/**
 * Walk a (mesh) input value and convert to the global pref dtype if needed.
 * Used by the operator-executor pre-flight to make operator inputs consistent
 * with the current setting.
 */
export function ensureOperandMeshDtype(operandId: string): void {
  const operand = operands.get(operandId)
  if (!operand || operand.type !== 'mesh') return
  const mesh = operand.data as tf.Mesh
  if (mesh.dtype === prefs.floatDtype) return
  convertMeshDtype(operandId, prefs.floatDtype)
}
