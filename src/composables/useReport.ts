import * as tf from '@polydera/trueform'
import { operands } from '@/core'
import type { useScene } from '@/scene/useScene'
import { computeNDArrayStats, type ComponentStats } from '@/core/ndarrayStats'
import { buildHistogram, type HistogramData } from '@/composables/histogram'

type Scene = ReturnType<typeof useScene>

// ── Discriminated union: one report type per operand kind ──

export interface MeshReport {
  kind: 'mesh'
  operandId: string
  label: string
  faces: number
  vertices: number
  isClosed: boolean
  isManifold: boolean
  boundaryEdgeCount: number
  nonManifoldEdgeCount: number
  hasSelfIntersections: boolean
  connectedComponents: number
  area: number
  volume: number
  curvatureStats: { min: number; max: number; mean: number; std: number } | null
  obbExtent: number[] | null
  issues: string[]
}

export interface CurvesReport {
  kind: 'curves'
  operandId: string
  label: string
  paths: number
  vertexRefs: number
  segments: number
  totalLength: number
  aabbExtent: number[] | null
}

export interface NDArrayReport {
  kind: 'ndarray'
  operandId: string
  label: string
  shape: number[]
  dtype: string
  length: number
  /** Count of NaN values in the array. Always 0 for non-float dtypes. */
  nanCount: number
  stats: { min: number; max: number; mean: number; std: number }
  components: ComponentStats[] | null
  /** Present only for 1D arrays; omitted for multi-dim where per-component stats stand in. */
  histogram: HistogramData | null
}

export type OperandReport = MeshReport | CurvesReport | NDArrayReport

// ── Cache keyed by (operandId, version) so replaceData invalidates ──

const reportCache = new Map<string, { report: OperandReport; version: number }>()

export function getCachedReport(nodeId: string): OperandReport | null {
  // The ContextPanel calls with nodeId, which by convention equals operandId.
  // Use it directly; if the operand has changed version, return null.
  const cached = reportCache.get(nodeId)
  if (!cached) return null
  const operand = operands.get(nodeId)
  if (!operand || operand.version !== cached.version) return null
  return cached.report
}

// ── Top-level dispatcher ──

/**
 * Generate an operand-type-appropriate report. Dispatches by the operand's
 * type — mesh / curves / ndarray — and caches the result keyed on the
 * operand's current version.
 */
export async function generateReport(nodeId: string, scene: Scene): Promise<OperandReport> {
  const node = scene.getNode(nodeId)
  if (!node?.operandId) throw new Error(`Node not found: ${nodeId}`)
  const operand = operands.get(node.operandId)
  if (!operand) throw new Error(`Operand not found for node: ${nodeId}`)

  const cached = reportCache.get(node.operandId)
  if (cached && cached.version === operand.version) return cached.report

  let report: OperandReport
  switch (operand.type) {
    case 'mesh':
      report = await generateMeshReport(node.id, node.label, operand.data as tf.Mesh, scene)
      break
    case 'curves':
      report = generateCurvesReport(node.id, node.label, scene)
      break
    case 'ndarray':
      report = generateNDArrayReport(node.id, node.label, operand.data as tf.NDArray)
      break
    default:
      throw new Error(`Analysis not supported for operand type: ${operand.type}`)
  }

  reportCache.set(node.operandId, { report, version: operand.version })
  return report
}

// ── Mesh report (existing behavior, now wrapped in discriminated union) ──

/**
 * Generates a mesh quality/measurement report.
 *
 * **Side effect**: when defects are detected (boundary edges, non-manifold
 * edges, self-intersections, disconnected components), child diagnostic
 * operands are spawned under the mesh node so the user can *see* the
 * problem regions highlighted in the viewport. This is intentional — the
 * report and the visualization are produced together.
 */
async function generateMeshReport(operandId: string, label: string, mesh: tf.Mesh, scene: Scene): Promise<MeshReport> {
  const props = scene.getProperties(operandId) ?? {}
  const faces = (props.faces as number) ?? mesh.numberOfFaces
  const vertices = (props.vertices as number) ?? mesh.numberOfPoints
  const issues: string[] = []

  const boundaryEdgeArr = await tf.async.boundaryEdges(mesh)
  const boundaryEdgeCount = boundaryEdgeArr.shape[0]!
  const isClosed = boundaryEdgeCount === 0

  if (boundaryEdgeCount > 0) {
    issues.push(`Open mesh (${boundaryEdgeCount} boundary edges)`)
    spawnDiagnosticCurves(scene, mesh, boundaryEdgeArr, operandId, {
      idPrefix: 'boundary-edges',
      label: 'Boundary Edges',
      color: '#ff4444',
    })
  }
  boundaryEdgeArr.delete()

  const nmEdgeArr = await tf.async.nonManifoldEdges(mesh)
  const nonManifoldEdgeCount = nmEdgeArr.shape[0]!
  const isManifold = nonManifoldEdgeCount === 0

  if (nonManifoldEdgeCount > 0) {
    issues.push(`Non-manifold (${nonManifoldEdgeCount} edges)`)
    spawnDiagnosticCurves(scene, mesh, nmEdgeArr, operandId, {
      idPrefix: 'non-manifold-edges',
      label: 'Non-manifold Edges',
      color: '#ff8800',
    })
  }
  nmEdgeArr.delete()

  let hasSelfIntersections = false
  try {
    const siCurves = await tf.async.selfIntersectionCurves(mesh)
    if (siCurves.length > 0) {
      hasSelfIntersections = true
      issues.push('Self-intersections found')
      const curveId = operands.nextId('self-intersections')
      operands.add({ id: curveId, type: 'curves', data: siCurves })
      scene.addNode({
        id: curveId,
        label: 'Self-intersections',
        parentId: operandId,
        order: 0,
        operandId: curveId,
        visible: true,
        color: '#ffcc00',
        opacity: 100,
        renderMode: 'solid',
      })
    } else {
      siCurves.delete()
    }
  } catch {
    // Can fail on some meshes — skip silently
  }

  const compResult = await tf.async.connectedComponents(mesh, 'edge' as tf.ComponentType)
  const connectedComponents = compResult.nComponents
  ;(compResult as any).labels?.delete?.()

  const area = Math.round((await tf.async.area(mesh)) * 10000) / 10000
  const volume = Math.round((await tf.async.volume(mesh)) * 10000) / 10000

  // Curvature: compute principal curvatures, derive mean curvature, run
  // through computeNDArrayStats so the reduction is WASM-parallelized.
  let curvatureStats: MeshReport['curvatureStats'] = null
  try {
    const { k0, k1 } = await tf.async.principalCurvatures(mesh, 2)
    const sum = k0.add(k1) as tf.NDArrayFloat32
    const meanCurv = sum.mul(0.5) as tf.NDArrayFloat32
    k0.delete()
    k1.delete()
    sum.delete()
    const stats = computeNDArrayStats(meanCurv)
    curvatureStats = { min: stats.min, max: stats.max, mean: stats.mean, std: stats.std }
    meanCurv.delete()
  } catch {
    // Can fail on degenerate meshes
  }

  const obb = props.obb as { extent?: unknown } | undefined
  let obbExtent: number[] | null = null
  if (obb?.extent) {
    const raw = (obb.extent as any).data ? Array.from((obb.extent as any).data as Float32Array) : (obb.extent as number[])
    obbExtent = raw.map((v: number) => Math.round(v * 100) / 100)
  }

  return {
    kind: 'mesh',
    operandId,
    label,
    faces,
    vertices,
    isClosed,
    isManifold,
    boundaryEdgeCount,
    nonManifoldEdgeCount,
    hasSelfIntersections,
    connectedComponents,
    area,
    volume,
    curvatureStats,
    obbExtent,
    issues,
  }
}

/**
 * Converts an edge-index array (e.g. from `boundaryEdges` / `nonManifoldEdges`)
 * into a curves operand and registers it as a child node of the mesh so the
 * defective regions render in the viewport. All WASM intermediates are
 * explicitly deleted. The caller still owns `edgeArr` and must delete it.
 */
function spawnDiagnosticCurves(
  scene: Scene,
  mesh: tf.Mesh,
  edgeArr: tf.NDArrayInt32,
  parentId: string,
  opts: { idPrefix: string; label: string; color: string },
): void {
  const paths = tf.connectEdgesToPaths(edgeArr)
  const pts = mesh.points
  const curves = tf.curves(paths, pts)
  pts.delete()
  paths.delete()
  const curveId = operands.nextId(opts.idPrefix)
  operands.add({ id: curveId, type: 'curves', data: curves })
  scene.addNode({
    id: curveId,
    label: opts.label,
    parentId,
    order: 0,
    operandId: curveId,
    visible: true,
    color: opts.color,
    opacity: 100,
    renderMode: 'solid',
  })
}

// ── Curves report: pulls straight from the cached curves properties ──

function generateCurvesReport(operandId: string, label: string, scene: Scene): CurvesReport {
  const props = scene.getProperties(operandId) ?? {}
  const paths = (props.paths as number) ?? 0
  const vertexRefs = (props.vertexRefs as number) ?? 0
  const segments = (props.segments as number) ?? Math.max(0, vertexRefs - paths)
  const totalLength = (props.totalLength as number) ?? 0

  const aabb = props.aabb as { data?: Float32Array } | undefined
  let aabbExtent: number[] | null = null
  if (aabb?.data && aabb.data.length === 6) {
    const d = aabb.data
    aabbExtent = [
      Math.round((d[3]! - d[0]!) * 100) / 100,
      Math.round((d[4]! - d[1]!) * 100) / 100,
      Math.round((d[5]! - d[2]!) * 100) / 100,
    ]
  }

  return { kind: 'curves', operandId, label, paths, vertexRefs, segments, totalLength, aabbExtent }
}

// ── NDArray report: pulls cached stats, computes histogram for 1D only ──

function generateNDArrayReport(operandId: string, label: string, arr: tf.NDArray): NDArrayReport {
  const stats = computeNDArrayStats(arr)
  const length = stats.shape.reduce((a, b) => a * b, 1)
  const histogram = stats.shape.length === 1 && length > 0 ? buildHistogram(arr) : null
  return {
    kind: 'ndarray',
    operandId,
    label,
    shape: stats.shape,
    dtype: stats.dtype,
    length,
    nanCount: stats.nanCount,
    stats: { min: stats.min, max: stats.max, mean: stats.mean, std: stats.std },
    components: stats.components ?? null,
    histogram,
  }
}
