import { operands } from '@/core'
import type { HandlerContext } from './types'
import { roundArr, sanitizeProperties } from './serialize'

export function handleWorldState(params: Record<string, unknown>, ctx: HandlerContext) {
  const requestedIds = params.nodeIds as string[] | undefined
  const visibleOnly = params.visibleOnly as boolean | undefined
  if (requestedIds && requestedIds.length > 0) {
    return {
      nodes: requestedIds.map((id) => buildNodeDetail(id, ctx)).filter(Boolean),
      selection: [...ctx.scene.activeSelection],
    }
  }
  let totalFaces = 0
  let meshCount = 0
  const nodes: unknown[] = []
  for (const [id, node] of ctx.scene.nodes) {
    if (visibleOnly && !node.visible) continue
    const operand = node.operandId ? operands.get(node.operandId) : undefined
    const props = node.operandId ? ctx.scene.getProperties(node.operandId) : undefined
    if (props?.faces) {
      totalFaces += props.faces as number
      meshCount++
    }
    let center: number[] | undefined
    if (operand && (operand.type === 'mesh' || operand.type === 'curves')) {
      const mat = (operand.data as any).transformation
      if (mat) center = roundArr([mat.data[3], mat.data[7], mat.data[11]])
      if (!center && props?.aabb) {
        const aabb = props.aabb as { data: Float32Array }
        if (aabb.data) {
          const d = aabb.data
          center = roundArr([(d[0]! + d[3]!) / 2, (d[1]! + d[4]!) / 2, (d[2]! + d[5]!) / 2])
        }
      }
    }
    nodes.push({
      id: node.id,
      label: node.label,
      type: operand?.type,
      visible: node.visible,
      center,
      parentId: node.parentId || undefined,
      children: ctx.scene.getChildren(id).length > 0 ? ctx.scene.getChildren(id) : undefined,
    })
  }
  const selection = [...ctx.scene.activeSelection]
  return {
    _guide:
      'Pass { nodeIds: [...] } for full detail per node: OBB (center, axes, extent — prefer over AABB), AABB, transform, children, faces, vertices. All in world space.',
    summary: `${meshCount} mesh${meshCount !== 1 ? 'es' : ''}, ${totalFaces} faces, ${selection.length} selected`,
    nodes,
    selection,
  }
}

function buildNodeDetail(id: string, ctx: HandlerContext) {
  const node = ctx.scene.getNode(id)
  if (!node) return null
  const operand = node.operandId ? operands.get(node.operandId) : undefined
  const properties = node.operandId ? ctx.scene.getProperties(node.operandId) : undefined
  const children = ctx.scene.getChildren(id)
  let transform: number[] | null = null
  if (operand) {
    const mat = (operand.data as any).transformation
    if (mat) transform = roundArr(Array.from(mat.data as Float32Array))
  }
  return {
    id: node.id,
    label: node.label,
    parentId: node.parentId,
    visible: node.visible,
    color: node.color,
    opacity: node.opacity,
    renderMode: node.renderMode,
    operandId: node.operandId,
    type: operand?.type,
    transform,
    children,
    properties: properties ? sanitizeProperties(properties, transform) : undefined,
    sceneOperatorState: node.sceneOperatorState,
  }
}
