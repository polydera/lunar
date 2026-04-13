import * as tf from '@polydera/trueform'
import type { ColorMapName } from '@/core'

/**
 * Colormap sampling.
 *
 * - viridis / plasma / turbo use polynomial samplers (matplotlib approximations).
 * - grayscale and rainbow are direct samplers.
 * - polydera is the brand map: piecewise-linear over hand-tuned waypoints,
 *   with TWO variants — sequential (unsigned data) and diverging (signed data).
 *   The variant auto-switches inside `buildColorBuffer` based on whether the
 *   clipped range crosses zero.
 *
 * Each LUT is a [256, 3] float32 NDArray built once and cached. Colormap
 * application is fully WASM-side: normalize → gather via `take` → single copy
 * into a JS-owned Float32Array for the GPU upload.
 */

// ── Sampler-based maps (polynomial / direct) ────────────────────────────────

type Sampler = (t: number) => [number, number, number]

function clamp01(x: number): number {
  return x < 0 ? 0 : x > 1 ? 1 : x
}

const viridis: Sampler = (t) => {
  const x = clamp01(t)
  const r = 0.2777273272 + x * (0.105294 + x * (-0.330887 + x * (-4.63423 + x * (6.228269 + x * (4.776384 - x * 5.435455)))))
  const g = 0.005407344 + x * (1.404613 + x * (0.214069 + x * (-5.7991 + x * (14.179609 + x * (-13.74546 + x * 4.645852)))))
  const b = 0.334791 + x * (1.38459 + x * (0.092933 + x * (-8.776678 + x * (16.602071 + x * (-13.929832 + x * 4.214813)))))
  return [clamp01(r), clamp01(g), clamp01(b)]
}

const plasma: Sampler = (t) => {
  const x = clamp01(t)
  const r = 0.05873234 + x * (2.176514 + x * (-2.68946 + x * (6.130348 + x * (-11.107437 + x * (10.027678 - x * 3.659257)))))
  const g = 0.0233367 + x * (0.235683 + x * (1.776691 + x * (-8.293658 + x * (14.024673 + x * (-12.47543 + x * 4.6603)))))
  const b = 0.5433251 + x * (1.45878 + x * (-3.811705 + x * (5.86478 + x * (-5.42096 + x * (3.02777 - x * 0.715661)))))
  return [clamp01(r), clamp01(g), clamp01(b)]
}

const turbo: Sampler = (t) => {
  const x = clamp01(t)
  const r = 0.13572138 + x * (4.6153926 + x * (-42.66032258 + x * (132.13108234 + x * (-152.94239396 + x * 59.28637943))))
  const g = 0.09140261 + x * (2.19418839 + x * (4.84296658 + x * (-14.18503333 + x * (4.27729857 + x * 2.82956604))))
  const b = 0.1066733 + x * (12.64194608 + x * (-60.58204836 + x * (110.36276771 + x * (-89.90310912 + x * 27.34824973))))
  return [clamp01(r), clamp01(g), clamp01(b)]
}

const grayscale: Sampler = (t) => {
  const x = clamp01(t)
  return [x, x, x]
}

const rainbow: Sampler = (t) => {
  const x = clamp01(t)
  const h = (1 - x) * (2 / 3) // 0.667 → 0
  const r = clamp01(Math.abs(h * 6 - 3) - 1)
  const g = clamp01(2 - Math.abs(h * 6 - 2))
  const b = clamp01(2 - Math.abs(h * 6 - 4))
  return [r, g, b]
}

const samplers: Partial<Record<ColorMapName, Sampler>> = {
  viridis,
  plasma,
  turbo,
  grayscale,
  rainbow,
}

// ── Polydera (waypoint-based, two variants, built with trueform ops) ────────

/**
 * Polydera sequential waypoints. Used when the data does not cross zero.
 * Cool (dark teal) → brand teal (at t=0.5) → warm (orange).
 */
const POLYDERA_SEQ_WAYPOINTS = new Float32Array([
  0x00 / 255,
  0x1a / 255,
  0x17 / 255, // #001a17 near-black teal
  0x00 / 255,
  0x6d / 255,
  0x63 / 255, // #006d63 dark teal
  0x00 / 255,
  0xd5 / 255,
  0xbe / 255, // #00d5be brand teal ★
  0xff / 255,
  0xbb / 255,
  0x7a / 255, // #ffbb7a warm peach
  0xff / 255,
  0x6b / 255,
  0x2c / 255, // #ff6b2c orange
])

/**
 * Polydera diverging waypoints. Used when the data crosses zero.
 * Orange (negative) → mid gray (zero, at t=0.5) → brand teal (positive).
 * Reuses the brand's secondary (orange) so the diverging map reads as an
 * evolution of the sequential one. The center gray is intentionally NOT the
 * background color — zero stays legible rather than vanishing.
 */
const POLYDERA_DIV_WAYPOINTS = new Float32Array([
  0xff / 255,
  0x6b / 255,
  0x2c / 255, // #ff6b2c orange
  0xa0 / 255,
  0x40 / 255,
  0x1a / 255, // #a0401a dark orange
  0x60 / 255,
  0x60 / 255,
  0x60 / 255, // #606060 mid gray ★ (zero)
  0x1a / 255,
  0x5a / 255,
  0x52 / 255, // #1a5a52 dark teal
  0x00 / 255,
  0xd5 / 255,
  0xbe / 255, // #00d5be brand teal
])

/**
 * Build a [256, 3] float32 LUT by piecewise-linearly interpolating between
 * N uniformly-spaced RGB waypoints. All math happens in trueform NDArrays —
 * no JS loops.
 *
 * Algorithm:
 *   t        = linspace(0, 1, 256)                    [256]
 *   scaled   = t * (N-1)                              [256]           ∈ [0, N-1]
 *   floored  = clip(floor(scaled), 0, N-2)            [256] float32
 *   u        = scaled - floored                       [256]           ∈ [0, 1]
 *   segIdx   = floored.as('int32')                    [256] int32
 *   nextIdx  = clip(segIdx + 1, 0, N-1)               [256] int32
 *   A        = waypoints.take(segIdx, axis=0)         [256, 3]
 *   B        = waypoints.take(nextIdx, axis=0)        [256, 3]
 *   result   = A + u.unsqueeze(1) * (B - A)           [256, 3]
 */
function buildPolyderaLutFromWaypoints(waypoints: Float32Array): tf.NDArrayFloat32 {
  const N = waypoints.length / 3
  const nSeg = N - 1

  const wp = tf.ndarray(waypoints, [N, 3]) as tf.NDArrayFloat32

  // t in [0, 1] with 256 evenly spaced values
  const t = tf.linspace(0, 1, 256) as tf.NDArrayFloat32

  // Scale to [0, nSeg]
  const scaled = t.mul(nSeg) as tf.NDArrayFloat32

  // floor + clamp to valid segment range (the right endpoint t=1 lands on
  // floored=nSeg which we clamp back to nSeg-1 so the lerp blends into the
  // last waypoint via u=1).
  const floored = tf.floor(scaled) as tf.NDArrayFloat32
  floored.clip_(0, nSeg - 1)

  // Fractional position within the segment, ∈ [0, 1]
  const u = scaled.sub(floored) as tf.NDArrayFloat32
  const uCol = u.unsqueeze(1) as tf.NDArrayFloat32 // [256, 1] broadcast column

  // Segment indices (int32) for gather
  const segIdx = floored.as('int32') as tf.NDArrayInt32
  const nextIdx = segIdx.add(1) as tf.NDArrayInt32
  nextIdx.clip_(0, N - 1)

  // Gather per-slot start/end colors: both [256, 3]
  const colorA = wp.take(segIdx, 0) as tf.NDArrayFloat32
  const colorB = wp.take(nextIdx, 0) as tf.NDArrayFloat32

  // lerp: result = colorA + u * (colorB - colorA)
  const diff = colorB.sub(colorA) as tf.NDArrayFloat32 // [256, 3]
  const weighted = diff.mul(uCol) as tf.NDArrayFloat32 // broadcast [256,3] × [256,1]
  const result = colorA.add(weighted) as tf.NDArrayFloat32 // [256, 3]

  // Cleanup all intermediates — result is kept by the cache.
  weighted.delete()
  diff.delete()
  colorB.delete()
  colorA.delete()
  nextIdx.delete()
  segIdx.delete()
  uCol.delete()
  u.delete()
  floored.delete()
  scaled.delete()
  t.delete()
  wp.delete()

  return result
}

// ── LUT cache ────────────────────────────────────────────────────────────────

/** Cached trueform LUTs, one per sampler colormap. Shape [256, 3] float32. */
const lutCache: Partial<Record<ColorMapName, tf.NDArrayFloat32>> = {}

/** Separate cache for the two polydera variants (not keyed by ColorMapName). */
const polyderaLutCache: { seq: tf.NDArrayFloat32 | null; div: tf.NDArrayFloat32 | null } = {
  seq: null,
  div: null,
}

function buildSamplerLut(name: ColorMapName): tf.NDArrayFloat32 {
  const sampler = samplers[name]
  if (!sampler) throw new Error(`No sampler for colormap "${name}"`)
  const data = new Float32Array(256 * 3)
  for (let i = 0; i < 256; i++) {
    const t = i / 255
    const [r, g, b] = sampler(t)
    data[i * 3] = r
    data[i * 3 + 1] = g
    data[i * 3 + 2] = b
  }
  return tf.ndarray(data, [256, 3]) as tf.NDArrayFloat32
}

function getPolyderaLut(signed: boolean): tf.NDArrayFloat32 {
  const key = signed ? 'div' : 'seq'
  const existing = polyderaLutCache[key]
  if (existing) return existing
  const waypoints = signed ? POLYDERA_DIV_WAYPOINTS : POLYDERA_SEQ_WAYPOINTS
  const built = buildPolyderaLutFromWaypoints(waypoints)
  polyderaLutCache[key] = built
  return built
}

export function getLut(name: ColorMapName): tf.NDArrayFloat32 {
  // Polydera resolves to its sequential variant by default. The auto-switch
  // between sequential/diverging happens in buildColorBuffer, which knows the
  // sign of the clipped range. Callers that ask for just "polydera" LUT get
  // the sequential (most neutral) choice.
  if (name === 'polydera') return getPolyderaLut(false)

  let lut = lutCache[name]
  if (!lut) {
    lut = buildSamplerLut(name)
    lutCache[name] = lut
  }
  return lut
}

/**
 * Sample a colormap at a single `t` in [0, 1] — used only for the degenerate
 * "all values equal" fallback in buildColorBuffer. Polydera falls back to its
 * sequential waypoints interpolated in JS (one-off, not on a hot path).
 */
function sampleAt(name: ColorMapName, t: number): [number, number, number] {
  const sampler = samplers[name]
  if (sampler) return sampler(t)
  if (name === 'polydera') {
    // Piecewise linear over POLYDERA_SEQ_WAYPOINTS.
    const wp = POLYDERA_SEQ_WAYPOINTS
    const N = wp.length / 3
    const nSeg = N - 1
    const scaled = clamp01(t) * nSeg
    const i = Math.min(nSeg - 1, Math.floor(scaled))
    const u = scaled - i
    const r = wp[i * 3]! * (1 - u) + wp[(i + 1) * 3]! * u
    const g = wp[i * 3 + 1]! * (1 - u) + wp[(i + 1) * 3 + 1]! * u
    const b = wp[i * 3 + 2]! * (1 - u) + wp[(i + 1) * 3 + 2]! * u
    return [r, g, b]
  }
  return [0, 0, 0]
}

// ── Main entry: build a JS-owned [V*3] color buffer for a mesh ──────────────

/**
 * Build a JS-owned [V*3] RGB color buffer for per-vertex scalar values,
 * computing normalization + LUT gather entirely in trueform (WASM).
 *
 * Steps (all in WASM except the final single copy):
 *   1. sorted.data[p*(n-1)] → percentile-clipped lo, hi
 *   2. symmetric wrap if the clipped range crosses zero
 *   3. pick LUT (polydera: seq/div based on sign; others: their own LUT)
 *   4. indices = clip((arr - lo) * (255 / (hi - lo)), 0, 255).as('int32')
 *   5. colors = lut.take(indices, 0)       → [V, 3] float32
 *   6. out = new Float32Array(colors.data) → JS-owned copy
 *   7. delete all intermediates
 */
export function buildColorBuffer(values: tf.NDArrayFloat32, mapName: ColorMapName, clipPercent: number): Float32Array {
  const n = values.length

  // Percentile-clipped range via sort.
  const p = Math.max(0, Math.min(49, clipPercent)) / 100
  const sorted = values.sort() as tf.NDArrayFloat32
  const sortedData = sorted.data
  const loIdx = Math.min(n - 1, Math.max(0, Math.floor(p * (n - 1))))
  const hiIdx = Math.min(n - 1, Math.max(0, Math.floor((1 - p) * (n - 1))))
  let lo = sortedData[loIdx]!
  let hi = sortedData[hiIdx]!
  sorted.delete()

  // Detect signed data (data crosses zero in the clipped window).
  const signed = lo < 0 && hi > 0

  // Symmetric range for signed data so zero lands at t=0.5 on any map.
  if (signed) {
    const m = Math.max(-lo, hi)
    lo = -m
    hi = m
  }

  // Pick the LUT. Polydera auto-switches between its two variants; everything
  // else uses its single sampler-based LUT.
  const lut = mapName === 'polydera' ? getPolyderaLut(signed) : getLut(mapName)

  // Degenerate: all values equal (or percentile window collapsed).
  if (!isFinite(lo) || !isFinite(hi) || lo === hi) {
    const [r, g, b] = sampleAt(mapName, 0.5)
    const out = new Float32Array(n * 3)
    for (let i = 0; i < n; i++) {
      out[i * 3] = r
      out[i * 3 + 1] = g
      out[i * 3 + 2] = b
    }
    return out
  }

  // Normalize to [0, 255]: (values - lo) * scale, clipped.
  // First op is copying (`sub`), the rest are in-place on the same buffer.
  const scale = 255 / (hi - lo)
  const work = values.sub(lo) as tf.NDArrayFloat32
  work.mul_(scale)
  work.clip_(0, 255)
  const indices = work.as('int32') as tf.NDArrayInt32

  // Gather colors by index from the LUT → [V, 3]
  const colors = lut.take(indices, 0) as tf.NDArrayFloat32

  // Single copy: WASM → JS-owned Float32Array
  const out = new Float32Array(colors.data)

  // Cleanup
  colors.delete()
  indices.delete()
  work.delete()

  return out
}
