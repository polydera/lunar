import { operators, operands } from '@/core'
import { OPERAND_TYPES } from '@/core/operands'
import { copyTransform } from '@/core/utils'
import type { Operator } from '@/core'
import type { useScene } from '@/scene/useScene'
import type { useInputMapping } from '@/composables/useInputMapping'
import type { useDispatcher } from '@/composables/useDispatcher'
import { getOperationMode } from '@/core/operationMode'
import { useUIState } from '@/composables/useUIState'
import { getUIInputHandler } from '@/ui/inputHandlers'
import { executeOperator, resolveInputs, type ExecuteContext } from '@/composables/operatorExecutor'

type Scene = ReturnType<typeof useScene>
type InputMapping = ReturnType<typeof useInputMapping>
type Dispatcher = ReturnType<typeof useDispatcher>

export function useActions(scene: Scene, inputMapping: InputMapping, dispatcher: Dispatcher) {
  const state = useUIState()
  const handlers = new Map<string, () => void | Promise<void>>()

  // ── Register / dispatch ────────────────────────────────

  function register(id: string, handler: () => void | Promise<void>) {
    handlers.set(id, handler)
  }

  function runAction(id: string) {
    const handler = handlers.get(id)
    if (handler) handler()
  }

  // ── Params: UI gatherer ────────────────────────────────
  //
  // Builds the canonical params dict (same shape MCP sends) from UI-side
  // state: `useUIState` for scalars, handler.combine for composite scalars,
  // `inputMapping.resolveChildId` for childInputs. Operand inputs themselves
  // aren't in params — they travel in `nodeIds`.
  //
  // The resolver (`resolveInputs`) consumes this params dict identically
  // whether it came from here or from an MCP request.

  function gatherParamsFromUI(op: Operator, nodeIds: string[]): Record<string, unknown> {
    const params: Record<string, unknown> = {}
    let operandIndex = 0

    for (const input of op.inputs) {
      if ((OPERAND_TYPES as readonly string[]).includes(input.type)) {
        // Operand input: the operand itself is in nodeIds, not params. The
        // childInput (if any) goes in params keyed by childInput.name — as
        // an operandId string, matching the MCP shape exactly.
        if (input.array) continue
        const nodeId = nodeIds[operandIndex]
        operandIndex++
        if (nodeId && input.childInput) {
          const childId = inputMapping.resolveChildId(nodeId, input.childInput.type, input.childInput.filter)
          if (childId) params[input.childInput.name] = childId
        }
        continue
      }

      // Scalar input. Handler-expanded inputs reduce sub-state through
      // `combine()` back to the real param's value. Plain scalars read
      // directly from state.
      const handler = getUIInputHandler(op.id, input.name)
      if (handler) {
        const subValues: Record<string, unknown> = {}
        for (const sub of handler.inputs(null)) {
          subValues[sub.name] = state[`${op.id}.${input.name}.${sub.name}`] ?? sub.default
        }
        params[input.name] = handler.combine(subValues)
        continue
      }

      const val = state[`${op.id}.${input.name}`]
      if (val !== undefined) params[input.name] = val
    }

    return params
  }

  // Build the ExecuteContext for a run. Source node is the first operand
  // nodeId when operand inputs exist; null for generators.
  function buildExecuteCtx(op: Operator, nodeIds: string[], origin: 'user' | 'mcp'): ExecuteContext {
    const hasOperandInputs = op.inputs.some((i) => (OPERAND_TYPES as readonly string[]).includes(i.type))
    const sourceNodeId = hasOperandInputs ? (nodeIds[0] ?? null) : null
    const sourceLabel = sourceNodeId ? scene.getNode(sourceNodeId)?.label : undefined
    return { scene, dispatcher, nodeIds, sourceNodeId, sourceLabel, origin }
  }

  // ── Run: UI path ───────────────────────────────────────

  async function runFromUI(opId: string, origin: 'user' | 'mcp' = 'user') {
    const op = operators.get(opId)
    if (!op) return

    const selection = [...scene.activeSelection]
    const mode = getOperationMode(op, selection.length)

    if (mode.kind === 'batch') {
      // One mesh input, N selected → run once per mesh. Each iteration
      // gathers its own per-mesh params (childInput can differ per mesh)
      // and fires independently.
      for (const nodeId of selection) {
        const params = gatherParamsFromUI(op, [nodeId])
        const inputs = resolveInputs(op, [nodeId], params, scene)
        if (!inputs) continue
        executeOperator(op, inputs, buildExecuteCtx(op, [nodeId], origin))
      }
      return
    }

    // Ordered, generator, or single mode — one call with all nodeIds.
    const params = gatherParamsFromUI(op, selection)
    const inputs = resolveInputs(op, selection, params, scene)
    if (!inputs) return
    await executeOperator(op, inputs, buildExecuteCtx(op, selection, origin))
  }

  // ── Run: MCP path ──────────────────────────────────────
  //
  // Single-shot: caller provides explicit `nodeIds` + `params` in the
  // canonical shape. No UI state is read or written. No selection hijack.
  // Batch semantics are the caller's responsibility — to run on multiple
  // meshes, the caller sends multiple operations in their run() request.

  async function runFromMCP(
    opId: string,
    nodeIds: string[],
    params: Record<string, unknown>,
  ): Promise<Record<string, unknown>> {
    const op = operators.get(opId)
    if (!op) throw new Error(`Unknown operator: ${opId}`)
    const inputs = resolveInputs(op, nodeIds, params, scene)
    if (!inputs) throw new Error(`${op.label}: unable to resolve inputs`)
    return await executeOperator(op, inputs, buildExecuteCtx(op, nodeIds, 'mcp'))
  }

  // ── Live-preview rebuild ───────────────────────────────

  /** Replace an existing node's operand data. Bumps version so viewport rebuilds geometry. */
  function replaceOperandData(nodeId: string, data: unknown) {
    const node = scene.getNode(nodeId)
    if (!node?.operandId) return
    const operand = operands.get(node.operandId)
    if (!operand) return
    copyTransform(operand.data as any, data as any)
    operands.replaceData(node.operandId, data)
    scene.dirty.add(nodeId)
  }

  /**
   * Sync rebuild: re-run the operator's `.sync()` with current UI params,
   * replace existing outputs in place via `replaceMap`. Used for live
   * generator preview — operator is UI-only in this path.
   */
  function rebuildSync(opId: string, replaceMap: Record<string, string>) {
    const op = operators.get(opId)
    if (!op) return
    const selection = [...scene.activeSelection]
    const params = gatherParamsFromUI(op, selection)
    const inputs = resolveInputs(op, selection, params, scene)
    if (!inputs) return
    const result = op.sync(inputs) as Record<string, unknown>
    for (const [outputName, nodeId] of Object.entries(replaceMap)) {
      const data = result[outputName]
      if (data != null) replaceOperandData(nodeId, data)
    }
  }

  // Async rebuild with latest-wins coalescing. At most one running + one pending.
  let _pendingRebuild: { opId: string; replaceMap: Record<string, string> } | null = null
  let _rebuildRunning = false

  function rebuildAsync(opId: string, replaceMap: Record<string, string>) {
    _pendingRebuild = { opId, replaceMap }
    if (_rebuildRunning) return
    _runNextRebuild()
  }

  function _runNextRebuild() {
    if (!_pendingRebuild) return
    const { opId, replaceMap } = _pendingRebuild
    _pendingRebuild = null
    _rebuildRunning = true

    const op = operators.get(opId)
    if (!op) {
      _rebuildRunning = false
      return
    }
    const selection = [...scene.activeSelection]
    const params = gatherParamsFromUI(op, selection)
    const inputs = resolveInputs(op, selection, params, scene)
    if (!inputs) {
      _rebuildRunning = false
      return
    }

    dispatcher
      .dispatch(op.label, 'rebuild', () => op.async(inputs))
      .then((result) => {
        _rebuildRunning = false
        const r = result as Record<string, unknown>
        for (const [outputName, nodeId] of Object.entries(replaceMap)) {
          const data = r[outputName]
          if (data != null) replaceOperandData(nodeId, data)
        }
        if (_pendingRebuild) _runNextRebuild()
      })
      .catch(() => {
        _rebuildRunning = false
        if (_pendingRebuild) _runNextRebuild()
      })
  }

  return {
    register,
    runAction,
    runFromUI,
    runFromMCP,
    rebuildSync,
    rebuildAsync,
  }
}
