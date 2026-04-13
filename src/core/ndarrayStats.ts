import * as tf from '@polydera/trueform'

export interface ComponentStats {
  min: number
  max: number
  mean: number
  std: number
}

export interface NDArrayStats {
  shape: number[]
  dtype: string
  min: number
  max: number
  mean: number
  std: number
  /**
   * Number of NaN values present in the array. 0 for non-float dtypes.
   * `min`/`max`/`mean`/`std` are computed over the non-NaN subset; without
   * this filtering, a single NaN would poison every stat.
   */
  nanCount: number
  /**
   * Per-component stats for 2D arrays where the second dimension is small
   * (e.g. normals `[V, 3]`, colors `[V, 4]`). Absent for 1D arrays and
   * wider shapes. Element i holds stats for column i. NaN filtering is
   * applied before per-component reductions too.
   */
  components?: ComponentStats[]
}

const COMPONENTS_MAX_WIDTH = 4 // XYZW / RGBA; beyond this the per-component table is noise.

const round = (v: number) => Math.round(v * 10000) / 10000

/**
 * Compute statistics for an ndarray using trueform's WASM reductions.
 *
 * Stats are cached on the operand the first time an ndarray node is added to
 * the scene. Both the UI (seeding sliders from bounds) and MCP (bot reasoning
 * about threshold values) read from the same cache via
 * `scene.getProperties(operandId)`.
 *
 * All heavy work runs inside WASM/TBB — parallel flat-buffer passes. No JS
 * loop iterates the data. Std is computed via mean-of-squares on an owned
 * mutable clone, using in-place `sub_` / `mul_(self)` to avoid allocating
 * intermediate buffers (one clone, one scalar reduction).
 *
 * Note: trueform's `norm()` no-axis has a known issue for large arrays
 * (parallel aggregator squares partial sums instead of adding them). We
 * avoid it entirely and derive std from `sum((x - mean)²) / n` via
 * `mul_(self)` + `sum()`, both of which use symmetric combiners and are
 * correct at scale.
 */
export function computeNDArrayStats(arr: tf.NDArray): NDArrayStats {
  const shape = Array.from(arr.shape) as number[]
  const dtype = String(arr.dtype ?? 'float32')
  const n = shape.reduce((a, b) => a * b, 1)

  if (n === 0) {
    return { shape, dtype, min: 0, max: 0, mean: 0, std: 0, nanCount: 0 }
  }

  // NaN poisons reductions (min/max/mean all become NaN if any element is
  // NaN). Count them up-front and, for multi-dim arrays, skip per-component
  // stats if NaN is present — axis reductions would all be NaN anyway.
  // The global stats below see the whole buffer; for 1D arrays we'll still
  // get useful values because we reshape-filter via `booleanIndex`, but for
  // 2D the axis structure is lost if we filter. Trade-off documented.
  //
  // Single-pass: build the *finite* mask once. NaN count is `n - finiteCount`
  // (NaN is the only float that fails `x === x`). For 1D the same mask is
  // reused by `booleanIndex` to gather the clean subset — no second scan.
  let nanCount = 0
  let statsArr: tf.NDArray = arr
  let statsOwned = false
  if (dtype === 'float32') {
    const finiteMask = arr.eq(arr) as tf.NDArrayBool
    const finiteInt = finiteMask.as('int32') as tf.NDArrayInt32
    const finiteCount = finiteInt.sum() as number
    finiteInt.delete()
    nanCount = n - finiteCount
    if (nanCount > 0 && shape.length === 1) {
      statsArr = arr.booleanIndex(finiteMask)
      statsOwned = true
    }
    finiteMask.delete()
  }

  const finiteN = statsArr.shape.reduce((a, b) => a * b, 1)
  const allNaN = nanCount > 0 && finiteN === 0

  const min = allNaN ? 0 : (statsArr.min() as number)
  const max = allNaN ? 0 : (statsArr.max() as number)
  const mean = allNaN ? 0 : (statsArr.mean() as number)
  const std = allNaN ? 0 : computeStd(statsArr, mean, finiteN, statsArr.dtype)

  if (statsOwned) statsArr.delete()

  const result: NDArrayStats = {
    shape,
    dtype,
    nanCount,
    min: round(min),
    max: round(max),
    mean: round(mean),
    std: round(std),
  }

  // Per-component stats: only for narrow 2D, and only when NaN-free (NaN in
  // any column poisons axis reductions; 1D filtering doesn't generalize).
  if (shape.length === 2 && shape[1]! >= 2 && shape[1]! <= COMPONENTS_MAX_WIDTH && nanCount === 0) {
    result.components = computeComponentStats(arr, shape[0]!, shape[1]!, dtype)
  }

  return result
}

/** Std via mean-of-squares on an owned clone. Pure WASM. */
function computeStd(arr: tf.NDArray, mean: number, n: number, dtype: string): number {
  const centered = cloneAsFloat32(arr, dtype)
  centered.sub_(mean)
  centered.mul_(centered)
  const variance = (centered.sum() as number) / n
  centered.delete()
  return Math.sqrt(variance)
}

/**
 * Owned float32 copy we can mutate in place.
 * - float32 input: `.clone()` — `.as('float32')` would return a shallow copy
 *   sharing the buffer; mutating it would corrupt the caller's data.
 * - other dtypes: `.as('float32')` already allocates a fresh buffer we own.
 */
function cloneAsFloat32(arr: tf.NDArray, dtype: string): tf.NDArrayFloat32 {
  if (dtype === 'float32') {
    return (arr as tf.NDArrayFloat32).clone()
  }
  return arr.as('float32') as tf.NDArrayFloat32
}

/** Per-column stats for a 2D ndarray of shape [N, K]. All via axis reductions. */
function computeComponentStats(arr: tf.NDArray, N: number, K: number, dtype: string): ComponentStats[] {
  const minPerCol = arr.min(0) as tf.NDArrayFloat32 // [K]
  const maxPerCol = arr.max(0) as tf.NDArrayFloat32 // [K]
  const meanPerCol = arr.mean(0) as tf.NDArrayFloat32 // [K]

  // Same mean-of-squares pattern, per-column: clone once, sub_ (broadcasts
  // [K] over [N, K]), mul_ (in-place square), sum(0) collapses axis 0 →
  // [K] sum of squared deviations. axis_reduce_impl doesn't use tf::reduce,
  // so no parallel-combiner bug here.
  const workCopy = cloneAsFloat32(arr, dtype)
  workCopy.sub_(meanPerCol)
  workCopy.mul_(workCopy)
  const sumSqPerCol = workCopy.sum(0) as tf.NDArrayFloat32 // [K]
  workCopy.delete()

  const minD = minPerCol.data
  const maxD = maxPerCol.data
  const meanD = meanPerCol.data
  const sumSqD = sumSqPerCol.data

  const stats: ComponentStats[] = []
  for (let k = 0; k < K; k++) {
    stats.push({
      min: round(minD[k]!),
      max: round(maxD[k]!),
      mean: round(meanD[k]!),
      std: round(Math.sqrt(sumSqD[k]! / N)),
    })
  }

  minPerCol.delete()
  maxPerCol.delete()
  meanPerCol.delete()
  sumSqPerCol.delete()

  return stats
}
