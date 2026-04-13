import * as THREE from 'three'
import { operators, operands, sceneOperators } from '@/core'
import { OPERAND_TYPES } from '@/core/operands'
import * as tf from '@polydera/trueform'
import { generateToolSchemas } from './toolSchemas'
import { registerSceneActions } from './actions/scene'
import { registerCameraActions } from './actions/camera'
import { registerGeometryActions } from './actions/geometry'
import { handleDiscover } from './discover'
import { handleWorldState } from './worldState'
import { validateOperation } from './validation'
import { roundArr, sanitizeProperties } from './serialize'
import type { HandlerContext, ActionDef, ActionRegistrar } from './types'

export type { HandlerContext, ActionDef, ActionRegistrar } from './types'

interface WSRequest {
  jsonrpc: '2.0'
  id: string
  method: string
  params: Record<string, unknown>
}

interface WSResponse {
  jsonrpc: '2.0'
  id: string
  result?: unknown
  error?: { code: number; message: string }
}

// ── Handler ───────────────────────────────────────────────

export function createHandler(ctx: HandlerContext) {
  const actionRegistry = new Map<string, ActionDef>()

  function register(def: ActionDef) {
    actionRegistry.set(def.id, def)
  }

  // ── Shared helpers (passed to action modules) ───────────

  function resolveTargets(nodeIds: string[]): string[] {
    if (nodeIds.length > 0) return nodeIds
    const sel = [...ctx.scene.activeSelection]
    if (sel.length === 0) throw new Error('No nodeIds given and nothing is selected')
    return sel
  }

  function applyTransform(nodeId: string, fn: (current: THREE.Matrix4) => THREE.Matrix4) {
    const node = ctx.scene.getNode(nodeId)
    if (!node?.operandId) throw new Error(`Node not found or has no operand: ${nodeId}`)
    const operand = operands.get(node.operandId)
    if (!operand) throw new Error(`Operand not found: ${node.operandId}`)

    const tfObj = operand.data as any
    const mat = tfObj.transformation
    const m = new THREE.Matrix4()
    if (mat) {
      m.fromArray(mat.data).transpose()
      mat.delete()
    }

    const result = fn(m)
    const rm = result.clone().transpose()
    const newMat = tf.ndarray(new Float32Array(rm.toArray())).reshape([4, 4])
    tfObj.transformation = newMat
    newMat.delete()
    ctx.scene.dirty.add(nodeId)
  }

  // ── Register all actions ────────────────────────────────

  const registrar: ActionRegistrar = { register, ctx, resolveTargets, applyTransform, sanitizeProperties, roundArr }
  registerSceneActions(registrar)
  registerCameraActions(registrar)
  registerGeometryActions(registrar)

  // ── JSON-RPC entry point ────────────────────────────────

  return async function handle(req: WSRequest): Promise<WSResponse> {
    try {
      const result = await dispatch(req.method, req.params ?? {})
      if (req.method !== 'discover' && req.method !== '__list_tools' && result && typeof result === 'object') {
        ;(result as Record<string, unknown>)._ctx = getContext()
      }
      return { jsonrpc: '2.0', id: req.id, result }
    } catch (e) {
      return {
        jsonrpc: '2.0',
        id: req.id,
        error: { code: -1, message: e instanceof Error ? e.message : String(e) },
      }
    }
  }

  async function dispatch(method: string, params: Record<string, unknown>): Promise<unknown> {
    switch (method) {
      case '__list_tools':
        return generateToolSchemas(actionRegistry)
      case 'discover':
        return handleDiscover(params, actionRegistry)
      case 'world_state':
        return handleWorldState(params, ctx)
      case 'run':
        return await handleRun(params)
      default:
        throw new Error(`Unknown method: ${method}`)
    }
  }

  function getContext() {
    const sel = ctx.scene.activeSelection
    const hover = ctx.scene.hoveredNode.value
    return {
      selection: sel.length > 0 ? [...sel] : undefined,
      hovered: hover ?? undefined,
      nodeCount: ctx.scene.nodes.size,
    }
  }

  // ── Run ───────────────────────────────────────────────

  async function handleRun(params: Record<string, unknown>) {
    const operations = params.operations as Array<{
      operatorId: string
      nodeIds?: string[]
      nodeId?: string
      params?: Record<string, unknown>
    }>
    if (!operations || !Array.isArray(operations)) throw new Error('operations array required')

    const results: unknown[] = []
    for (let i = 0; i < operations.length; i++) {
      const op = operations[i]!
      ctx.onProgress?.(op.operatorId, 'running', i)
      try {
        const nodeIds = op.nodeIds ?? (op.nodeId ? [op.nodeId] : [])
        const opParams = op.params ?? {}
        validateOperation({ operatorId: op.operatorId, nodeIds, params: opParams }, ctx, actionRegistry)
        results.push(await executeSingle(op))
      } catch (e) {
        results.push({ error: e instanceof Error ? e.message : String(e), operatorId: op.operatorId })
      }
      ctx.onProgress?.(op.operatorId, 'done', i)
    }
    return { results }
  }

  async function executeSingle(op: {
    operatorId: string
    nodeIds?: string[]
    nodeId?: string
    params?: Record<string, unknown>
  }): Promise<unknown> {
    const { operatorId, nodeIds: rawNodeIds, nodeId, params: opParams } = op
    const nodeIds = rawNodeIds ?? (nodeId ? [nodeId] : [])
    const params = opParams ?? {}

    const so = sceneOperators.get(operatorId)
    if (so) {
      const target = nodeIds[0]
      if (!target) throw new Error(`nodeId required for scene operator ${operatorId}`)
      so.apply(target, params, ctx.scene)
      return { operator: so.label, applied: target }
    }

    const action = actionRegistry.get(operatorId)
    if (action) {
      return await action.execute(nodeIds, params)
    }

    const operator = operators.get(operatorId)
    if (!operator) throw new Error(`Unknown operator: ${operatorId}`)

    const beforeIds = new Set(ctx.scene.nodes.keys())
    const result = await ctx.actions.runFromMCP(operatorId, nodeIds, params)

    const created: unknown[] = []
    for (const [id, node] of ctx.scene.nodes) {
      if (beforeIds.has(id)) continue
      const operand = node.operandId ? operands.get(node.operandId) : undefined
      const properties = node.operandId ? ctx.scene.getProperties(node.operandId) : undefined
      created.push({
        id: node.id,
        label: node.label,
        parentId: node.parentId,
        type: operand?.type,
        properties: properties ? sanitizeProperties(properties) : undefined,
      })
    }

    const scalars: Record<string, unknown> = {}
    for (const out of operator.outputs) {
      if ((OPERAND_TYPES as readonly string[]).includes(out.type)) continue
      const val = result[out.name]
      if (val !== undefined) scalars[out.name] = val
    }

    const response: Record<string, unknown> = { operator: operator.label, created, totalNodes: ctx.scene.nodes.size }
    if (Object.keys(scalars).length > 0) response.values = scalars
    return response
  }
}
