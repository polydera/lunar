import * as tf from '@polydera/trueform'

export const OPERAND_TYPES = ['mesh', 'pointcloud', 'curves', 'ndarray'] as const
export type OperandType = (typeof OPERAND_TYPES)[number]

export function isOperandType(t: string): t is OperandType {
  return (OPERAND_TYPES as readonly string[]).includes(t)
}

export interface Operand {
  id: string
  type: OperandType
  data: unknown
  version: number
}

// ── PointCloud cache ──────────────────────────────────────────────────────────
//
// Spatial queries on a PointCloud (closest-point, ICP) need a built tree, and
// the build is expensive. Operators that re-wrap the same mesh repeatedly
// (e.g. align run twice on the same pair) shouldn't pay that cost twice.
//
// Cache keyed by the underlying tf.Mesh handle. The PointCloud + tree are
// built lazily on first request. We store the in-flight Promise so concurrent
// callers share the same build. On operand removal/replacement, the cached
// PointCloud's WASM handle is freed.
//
// Safe under "operators always return new meshes" — a mesh handle never has
// its vertices mutated underneath us, so the cached PC stays valid for the
// life of the mesh operand.

const pointCloudCache = new Map<tf.Mesh, Promise<tf.PointCloud>>()

/** Get a cached PointCloud (with built tree) for the given mesh. */
export async function getCachedPointCloud(mesh: tf.Mesh): Promise<tf.PointCloud> {
  const existing = pointCloudCache.get(mesh)
  if (existing) return existing
  const pending = (async () => {
    const pc = tf.pointCloud(mesh)
    await tf.async.buildTree(pc)
    return pc
  })()
  pointCloudCache.set(mesh, pending)
  return pending
}

/** Free the cached PointCloud (if any) when its source mesh goes away. */
function disposeCachedPointCloud(mesh: tf.Mesh): void {
  const pending = pointCloudCache.get(mesh)
  if (!pending) return
  pointCloudCache.delete(mesh)
  pending.then((pc) => pc.delete()).catch(() => {})
}

/**
 * Scene-level hook for invalidating cached properties when an operand's data
 * is replaced. Wired at app boot in `App.vue` via `setPropertiesInvalidator(
 * scene.invalidateProperties)`. Kept as a setter rather than an import to
 * avoid a circular dependency between `src/core/operands` and
 * `src/scene/useScene`.
 */
let propertiesInvalidator: ((operandId: string) => void) | null = null
export function setPropertiesInvalidator(fn: (operandId: string) => void): void {
  propertiesInvalidator = fn
}

export class OperandRegistry {
  private operands = new Map<string, Operand>()
  private counters = new Map<string, number>()

  nextId(prefix: string): string {
    const count = (this.counters.get(prefix) ?? 0) + 1
    this.counters.set(prefix, count)
    return `${prefix}-${count}`
  }

  add(operand: Omit<Operand, 'version'>): void {
    this.operands.set(operand.id, { ...operand, version: 0 })
  }

  /** Replace operand data in place and bump version. */
  replaceData(id: string, data: unknown): void {
    const operand = this.operands.get(id)
    if (!operand) return
    if (operand.type === 'mesh') disposeCachedPointCloud(operand.data as tf.Mesh)
    operand.data = data
    operand.version++
    // Properties cached by the scene (aabb/obb/stats) describe the OLD data
    // and are now stale. Drop them; they'll be recomputed by the preview
    // commit path. During the drag, readers see undefined and handle it.
    propertiesInvalidator?.(id)
  }

  get(id: string): Operand | undefined {
    return this.operands.get(id)
  }

  remove(id: string): boolean {
    const operand = this.operands.get(id)
    if (operand?.type === 'mesh') disposeCachedPointCloud(operand.data as tf.Mesh)
    return this.operands.delete(id)
  }

  has(id: string): boolean {
    return this.operands.has(id)
  }

  all(): Operand[] {
    return [...this.operands.values()]
  }

  ids(): string[] {
    return [...this.operands.keys()]
  }
}

export const operands = new OperandRegistry()
