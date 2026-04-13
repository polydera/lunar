import * as THREE from 'three'

export function roundArr(arr: number[]): number[] {
  return arr.map((v) => Math.round(v * 10000) / 10000)
}

export function sanitizeProperties(
  props: Record<string, unknown>,
  worldTransform?: number[] | null,
): Record<string, unknown> {
  let mat: THREE.Matrix4 | null = null
  if (worldTransform && worldTransform.length === 16) {
    mat = new THREE.Matrix4().fromArray(worldTransform).transpose()
  }
  const result: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(props)) {
    if (value && typeof value === 'object') {
      if ('origin' in value && 'axes' in value && 'extent' in value) {
        const obb = value as { origin: { data: Float32Array }; axes: { data: Float32Array }; extent: { data: Float32Array } }
        const o = obb.origin.data
        const a = obb.axes.data
        const e = obb.extent.data
        const localCenter = new THREE.Vector3(
          o[0]! + 0.5 * (a[0]! * e[0]! + a[3]! * e[1]! + a[6]! * e[2]!),
          o[1]! + 0.5 * (a[1]! * e[0]! + a[4]! * e[1]! + a[7]! * e[2]!),
          o[2]! + 0.5 * (a[2]! * e[0]! + a[5]! * e[1]! + a[8]! * e[2]!),
        )
        const axis0 = new THREE.Vector3(a[0]!, a[1]!, a[2]!)
        const axis1 = new THREE.Vector3(a[3]!, a[4]!, a[5]!)
        const axis2 = new THREE.Vector3(a[6]!, a[7]!, a[8]!)
        if (mat) {
          localCenter.applyMatrix4(mat)
          axis0.transformDirection(mat)
          axis1.transformDirection(mat)
          axis2.transformDirection(mat)
        }
        result[key] = {
          center: roundArr(localCenter.toArray()),
          axes: [roundArr(axis0.toArray()), roundArr(axis1.toArray()), roundArr(axis2.toArray())],
          extent: roundArr(Array.from(e)),
        }
      } else if ('data' in value) {
        const arr = Array.from((value as { data: Float32Array }).data)
        if (key === 'aabb' && arr.length === 6) {
          const min = new THREE.Vector3(arr[0]!, arr[1]!, arr[2]!)
          const max = new THREE.Vector3(arr[3]!, arr[4]!, arr[5]!)
          if (mat) {
            min.applyMatrix4(mat)
            max.applyMatrix4(mat)
          }
          const worldMin = new THREE.Vector3(Math.min(min.x, max.x), Math.min(min.y, max.y), Math.min(min.z, max.z))
          const worldMax = new THREE.Vector3(Math.max(min.x, max.x), Math.max(min.y, max.y), Math.max(min.z, max.z))
          result[key] = { min: roundArr(worldMin.toArray()), max: roundArr(worldMax.toArray()) }
        } else {
          result[key] = arr
        }
      } else {
        result[key] = value
      }
    } else {
      result[key] = value
    }
  }
  return result
}
