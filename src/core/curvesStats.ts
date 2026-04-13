import * as tf from '@polydera/trueform'

export interface CurvesStats {
  /** Number of disjoint paths (loops / strokes). */
  paths: number
  /** Total vertex references across all paths = sum of per-path lengths. */
  vertexRefs: number
  /** Total edge segments = vertexRefs − paths (each path of N verts has N−1 edges). */
  segments: number
  /** World-space AABB of the shared point buffer. Curves reference a subset of these. */
  aabb: tf.NDArrayFloat32
  /** Sum of per-edge Euclidean lengths. */
  totalLength: number
}

const round = (v: number) => Math.round(v * 10000) / 10000

/**
 * Compute properties of a curves operand using WASM primitives:
 *   - `paths`: constant-time getter on the handle.
 *   - `vertexRefs` / `segments`: derived from the flat path data length.
 *     `curves.points` is shared with the parent mesh — its length is the
 *     mesh's vertex count, NOT what the curves actually use. The real
 *     curve-specific count comes from `paths.data.shape[0]` (sum of path
 *     vertex-index lengths).
 *   - `aabb`: trueform's `aabbFrom(points)` (WASM).
 *   - `totalLength`: sum of per-edge euclidean lengths, computed entirely
 *     on the worker via `take` / `sub` / `norm(axis=1)` / `sum`. Handles
 *     path boundaries: pair *all* consecutive flat-data vertex indices as
 *     edges (including fake edges spanning path ends), then subtract the
 *     lengths of the fake edges.
 *
 * Every intermediate NDArray is explicitly `.delete()`-ed — no leaks.
 */
export function computeCurvesStats(curves: tf.Curves): CurvesStats {
  const paths = curves.length

  // Each `curves.paths.*` / `curves.points` access allocates a handle — fetch
  // each buffer exactly once, share between metric + totalLength, delete at
  // the end. Cleaner than letting each helper re-fetch and re-delete.
  const data = curves.paths.data // [D] int32
  const offsets = curves.paths.offsets // [P+1] int32
  const points = curves.points // [V, 3] float32

  const vertexRefs = data.shape[0]!
  const segments = Math.max(0, vertexRefs - paths)
  const aabb = tf.aabbFrom(points) as tf.NDArrayFloat32
  const totalLength = paths === 0 || segments === 0 ? 0 : computeTotalLength(data, offsets, points)

  data.delete()
  offsets.delete()
  points.delete()

  return { paths, vertexRefs, segments, aabb, totalLength: round(totalLength) }
}

/**
 * Sum of per-edge lengths across all paths. Pure WASM — the only JS work
 * is the final scalar subtraction.
 *
 * Data layout (from `OffsetBlockedBuffer`):
 *   `data`    [D] — all vertex indices concatenated, one segment per path
 *   `offsets` [P+1] — block boundaries: path p covers data[off[p]..off[p+1])
 *
 * Strategy:
 *   1. Build (source, target) edge-endpoint index arrays as [D-1] views:
 *      source = data[0..D-1], target = data[1..D]. These include P-1
 *      "fake" edges spanning path boundaries.
 *   2. Gather their points, take diffs, compute per-edge norm → [D-1].
 *   3. Sum all, then subtract the sum of the P-1 fake edges. Fake edge i
 *      sits at position `offsets[i+1] - 1` in the edge array.
 *
 * Buffers are passed in (not re-fetched) so the caller owns their lifetime.
 */
function computeTotalLength(data: tf.NDArrayInt32, offsets: tf.NDArrayInt32, points: tf.NDArrayFloat32): number {
  const D = data.shape[0]!
  const P = offsets.shape[0]! - 1

  if (D < 2) return 0

  const source = data.slice(0, D - 1) as tf.NDArrayInt32
  const target = data.slice(1, D) as tf.NDArrayInt32
  const sourcePts = points.take(source, 0) as tf.NDArrayFloat32
  const targetPts = points.take(target, 0) as tf.NDArrayFloat32

  // diffs = targetPts - sourcePts. Own targetPts so we can mutate in place.
  targetPts.sub_(sourcePts)
  const edgeLengths = targetPts.norm(1) as tf.NDArrayFloat32 // [D-1]
  const totalWithFakes = edgeLengths.sum() as number

  let fakesTotal = 0
  if (P > 1) {
    // Fake edges live at indices offsets[1..P-1] - 1 in edgeLengths.
    const fakeIdxView = offsets.slice(1, P) as tf.NDArrayInt32 // [P-1]
    const fakeIdx = fakeIdxView.sub(1) as tf.NDArrayInt32 // allocates owned buf
    const fakeLengths = edgeLengths.take(fakeIdx, 0) as tf.NDArrayFloat32
    fakesTotal = fakeLengths.sum() as number
    fakeIdxView.delete()
    fakeIdx.delete()
    fakeLengths.delete()
  }

  source.delete()
  target.delete()
  sourcePts.delete()
  targetPts.delete()
  edgeLengths.delete()

  return totalWithFakes - fakesTotal
}
