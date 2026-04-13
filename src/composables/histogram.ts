import * as tf from '@polydera/trueform'

export interface HistogramData {
  /** Min over non-NaN values. Zero if array is empty / all-NaN. */
  min: number
  /** Max over non-NaN values. */
  max: number
  /** One count per bin. `bins.length` is at most the requested bin count —
   *  reduced for integer arrays with small ranges so every bucket covers
   *  one integer value (no empty-gap striping). */
  bins: number[]
  /** Number of NaN values filtered out before binning. Always 0
   *  for non-float dtypes. Displayed separately in the report. */
  nanCount: number
}

const INT_BINS_CEILING = 64 // int arrays with (max - min + 1) ≤ this get one-bin-per-value.
const round = (v: number) => Math.round(v * 10000) / 10000

/**
 * Compute a fixed-bin histogram for a 1D NDArray via `tf.histogram`.
 *
 * Intended for flat (1D) arrays only — the NDArray report skips histograms
 * for multi-dim arrays and shows per-component stats instead.
 *
 * Handling:
 *   - NaN values are silently dropped by the native primitive. The count
 *     is recovered as `n − sum(counts)`.
 *   - For integer dtypes with a small dynamic range (`max − min + 1 ≤ 64`)
 *     we collapse the bin count so each integer value gets its own bar —
 *     avoids empty-gap striping for binary labels etc.
 */
export function buildHistogram(arr: tf.NDArray, bins: number = 50): HistogramData {
  if (arr.shape.length !== 1) {
    throw new Error(`buildHistogram: expected 1D array, got shape [${Array.from(arr.shape).join(', ')}]`)
  }
  const n = arr.shape[0]!
  if (n === 0 || bins <= 0) {
    return { min: 0, max: 0, bins: [], nanCount: 0 }
  }

  // For int dtypes with a small dynamic range, use one bin per integer value
  // so binary / small-label arrays show clean bars instead of spikes separated
  // by empty bins. Float arrays keep the requested bin count.
  let binCount = bins
  if (arr.dtype !== 'float32') {
    const lo = arr.min() as number
    const hi = arr.max() as number
    const intRange = Math.round(hi - lo) + 1
    if (intRange >= 1 && intRange <= INT_BINS_CEILING) binCount = intRange
  }

  const { counts, edges } = tf.histogram(arr, { bins: binCount })

  // NaN is silently dropped by tf.histogram — recover count from the gap.
  const totalCounted = (counts as tf.NDArrayInt32).sum() as number
  const nanCount = n - totalCounted

  const countsData = Array.from(counts.data as Int32Array)
  const edgesData = edges.data as Float32Array
  const min = edgesData[0]!
  const max = edgesData[countsData.length]!

  counts.delete()
  edges.delete()

  return { min: round(min), max: round(max), bins: countsData, nanCount }
}
