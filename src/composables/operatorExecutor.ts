import type { Operator } from '@/core'
import { operands } from '@/core'
import { OPERAND_TYPES } from '@/core/operands'
import { copyTransform } from '@/core/utils'
import { prefs } from '@/composables/usePreferences'
import type { useScene } from '@/scene/useScene'
import type { useDispatcher } from '@/composables/useDispatcher'

type Scene = ReturnType<typeof useScene>
type Dispatcher = ReturnType<typeof useDispatcher>

/**
 * Resolve an operator's `(nodeIds, params)` to the inputs dict that
 * `op.async()` destructures. Pure schema walk — reads only the scene graph
 * and the operand registry (both are "what exists", not UI state). Same
 * code path for UI and MCP callers; `params` is the canonical shape both
 * produce (UI via `gatherParamsFromUI`, MCP directly from the request).
 *
 * Returns null when a required input can't be resolved (missing nodeId,
 * type mismatch, missing non-optional childInput).
 *
 * Shape of `params`:
 *   - Scalar input `name` → value (or omitted → schema default applies)
 *   - childInput `name` → operandId string (or omitted → filter-first-match)
 *   - Operand inputs themselves are NOT in params; they travel in `nodeIds`
 *     positionally.
 */
export function resolveInputs(
  op: Operator,
  nodeIds: string[],
  params: Record<string, unknown>,
  scene: Scene,
): Record<string, unknown> | null {
  const inputs: Record<string, unknown> = {}
  let operandIndex = 0

  for (const input of op.inputs) {
    if (!(OPERAND_TYPES as readonly string[]).includes(input.type)) {
      inputs[input.name] = params[input.name] ?? input.default
      continue
    }

    if (input.array) {
      const arr: unknown[] = []
      for (const nodeId of nodeIds) {
        const node = scene.getNode(nodeId)
        if (!node?.operandId) continue
        const operand = operands.get(node.operandId)
        if (operand && operand.type === input.type) arr.push(operand.data)
      }
      inputs[input.name] = arr
      continue
    }

    const nodeId = nodeIds[operandIndex]
    operandIndex++
    if (!nodeId) return null
    const node = scene.getNode(nodeId)
    if (!node?.operandId) return null
    const operand = operands.get(node.operandId)
    if (!operand) return null
    inputs[input.name] = operand.data

    if (input.childInput) {
      const childInput = input.childInput
      const childId = params[childInput.name]
      if (typeof childId === 'string') {
        const childOperand = operands.get(childId)
        if (childOperand && childOperand.type === childInput.type) {
          inputs[childInput.name] = childOperand.data
        } else if (!childInput.optional) {
          return null
        }
      } else if (!childInput.optional) {
        return null
      }
    }
  }

  return inputs
}

/**
 * Context passed to `executeOperator`. Carries everything the executor needs
 * to dispatch and place outputs into the scene, but nothing about where the
 * inputs came from — UI state, MCP params, etc. are all resolved upstream.
 */
export interface ExecuteContext {
  scene: Scene
  dispatcher: Dispatcher
  /** NodeIds that supplied the operand inputs (positional). Used to build the
   *  input-name → nodeId map for `inheritTransformation` and linked outputs. */
  nodeIds: string[]
  /** Parent node for outputAsChild / for top-level label prefix. Typically
   *  `nodeIds[0]` when there are operand inputs; null for generators. */
  sourceNodeId: string | null
  /** Label used on the task-panel task (usually the source mesh's label). */
  sourceLabel?: string | null
  /** Provenance badge on the task — bot icon for MCP, mouse for user. */
  origin?: 'user' | 'mcp'
}

/**
 * Run an operator with pre-resolved inputs. Pure with respect to input
 * sources — does not read from `useUIState`, `inputMapping`, or MCP request
 * state. Dispatches through the task queue, then places the operator's
 * outputs into the scene.
 *
 * Shared by both `runFromUI` and `runFromMCP` in `useActions`. The only
 * difference between those paths is where `resolvedInputs` came from.
 */
export async function executeOperator(
  op: Operator,
  resolvedInputs: Record<string, unknown>,
  ctx: ExecuteContext,
): Promise<Record<string, unknown>> {
  const inputNodes = buildInputNodes(op, ctx.nodeIds)
  const result = (await ctx.dispatcher.dispatch(
    op.label,
    ctx.sourceLabel ?? undefined,
    () => op.async(resolvedInputs),
    ctx.origin,
  )) as Record<string, unknown>

  handleOutputs(op, result, ctx.sourceNodeId, inputNodes, resolvedInputs, ctx.scene)

  // Generators / operators with no outputs still need the input nodes marked
  // dirty so viewport sync picks up any in-place state changes.
  if (op.outputs.length === 0) {
    for (const nodeId of ctx.nodeIds) ctx.scene.dirty.add(nodeId)
  }

  return result
}

/**
 * Build a positional map from operator input name → source nodeId. Only
 * non-array single-operand inputs get an entry (arrays don't map 1:1). Used
 * by `handleOutputs` for `inheritTransformation` and linked outputs.
 */
function buildInputNodes(op: Operator, nodeIds: string[]): Record<string, string> {
  const map: Record<string, string> = {}
  let operandIndex = 0
  for (const input of op.inputs) {
    if (!(OPERAND_TYPES as readonly string[]).includes(input.type)) continue
    if (input.array) continue
    const nodeId = nodeIds[operandIndex]
    if (nodeId) map[input.name] = nodeId
    operandIndex++
  }
  return map
}

/**
 * Create scene nodes for each operand output, stash scalar outputs as
 * properties on the source node, and auto-hide inputs when appropriate.
 *
 * Reads `operatorInputs` (the resolved inputs dict) for:
 *   - `inheritTransformation`: copy transform from the named input
 *   - `condition`: read the referenced input's value to decide if an
 *     optional output should materialize (replaces the old `state[...]` read)
 */
function handleOutputs(
  op: Operator,
  result: Record<string, unknown>,
  sourceNodeId: string | null,
  inputNodes: Record<string, string>,
  operatorInputs: Record<string, unknown>,
  scene: Scene,
): void {
  const operandOutputs = op.outputs.filter((o) => (OPERAND_TYPES as readonly string[]).includes(o.type))
  const scalarOutputs = op.outputs.filter((o) => !(OPERAND_TYPES as readonly string[]).includes(o.type))

  const sourceLabel = sourceNodeId ? scene.getNode(sourceNodeId)?.label : null
  const topLabel = sourceLabel ? `${op.label}: ${sourceLabel}` : op.label

  // Dynamic label overrides from the operator's return dict. Keyed by output
  // name. String → single output; string[] → per-item for arrays.
  const labelOverrides = ((result as Record<string, unknown>).__labels ?? {}) as Record<string, string | string[]>
  function getLabel(outputName: string, fallback: string, index?: number): string {
    const override = labelOverrides[outputName]
    if (!override) return fallback
    if (Array.isArray(override)) return override[index ?? 0] ?? fallback
    return override
  }

  // Determine parent for outputs
  let parentId: string | null = null
  if (op.outputAsChild && sourceNodeId) {
    parentId = sourceNodeId
  }

  // Primary output → add first, becomes parent for the rest
  const primaryOutput = operandOutputs.find((o) => o.primary)
  const hasPrimary = !!primaryOutput

  if (!hasPrimary && operandOutputs.length > 1) {
    const groupId = operands.nextId(op.label.toLowerCase().replace(/\s+/g, '-'))
    scene.addNode({
      id: groupId,
      label: topLabel,
      parentId,
      order: 0,
      visible: true,
      color: prefs.defaultObjectColor,
      opacity: 100,
      renderMode: 'solid',
    })
    parentId = groupId
  }

  if (hasPrimary) {
    const data = result[primaryOutput!.name]
    if (data != null) {
      if (primaryOutput!.inheritTransformation) {
        const src = operatorInputs[primaryOutput!.inheritTransformation]
        if (src) copyTransform(src as any, data as any)
      }
      const id = operands.nextId(op.label.toLowerCase().replace(/\s+/g, '-'))
      operands.add({ id, type: primaryOutput!.type as any, data })
      scene.addNode({
        id,
        label: getLabel(primaryOutput!.name, parentId ? primaryOutput!.label : topLabel),
        parentId,
        order: 0,
        operandId: id,
        visible: true,
        color: primaryOutput!.type === 'curves' ? prefs.defaultCurvesColor : prefs.defaultObjectColor,
        opacity: 100,
        renderMode: 'solid',
      })
      parentId = id
    }
  }

  // Remaining operand outputs
  for (const output of operandOutputs) {
    if (output.primary) continue

    if (output.condition) {
      // Read the conditioning input from the resolved inputs dict — identical
      // value whether the caller was UI or MCP, no state lookup needed.
      const condValue = operatorInputs[output.condition.input] ?? false
      if (condValue !== output.condition.value) continue
    }

    const data = result[output.name]
    if (data == null) continue

    if (output.array && Array.isArray(data)) {
      for (let i = 0; i < data.length; i++) {
        const id = operands.nextId(op.label.toLowerCase().replace(/\s+/g, '-'))
        operands.add({ id, type: output.type as any, data: data[i] })
        const fallback = data.length === 1 ? output.label : `${output.label} ${i + 1}`
        scene.addNode({
          id,
          label: getLabel(output.name, fallback, i),
          parentId,
          order: 0,
          operandId: id,
          visible: true,
          color: output.type === 'curves' ? prefs.defaultCurvesColor : prefs.defaultObjectColor,
          opacity: 100,
          renderMode: 'solid',
        })
      }
      continue
    }

    // Linked output: one operand, multiple scene nodes (one per linked input)
    if (output.linkToInputs && output.linkToInputs.length > 0) {
      const operandId = operands.nextId(op.label.toLowerCase().replace(/\s+/g, '-'))
      operands.add({ id: operandId, type: output.type as any, data })

      for (const inputName of output.linkToInputs) {
        const linkedNodeId = inputNodes[inputName]
        if (!linkedNodeId) continue
        const linkedLabel = scene.getNode(linkedNodeId)?.label ?? inputName
        scene.addNode({
          id: operands.nextId(operandId),
          label: `${output.label}: ${linkedLabel}`,
          parentId: linkedNodeId,
          order: 0,
          operandId,
          visible: true,
          color: output.type === 'curves' ? prefs.defaultCurvesColor : prefs.defaultObjectColor,
          opacity: 100,
          renderMode: 'solid',
        })
      }
      continue
    }

    const id = operands.nextId(op.label.toLowerCase().replace(/\s+/g, '-'))
    operands.add({ id, type: output.type as any, data })

    scene.addNode({
      id,
      label: getLabel(output.name, parentId ? output.label : topLabel),
      parentId,
      order: 0,
      operandId: id,
      visible: true,
      color: output.type === 'curves' ? prefs.defaultCurvesColor : prefs.defaultObjectColor,
      opacity: 100,
      renderMode: 'solid',
    })
  }

  // Scalar outputs → properties of source node
  if (scalarOutputs.length > 0 && sourceNodeId) {
    const selectedNode = scene.getNode(sourceNodeId)
    if (selectedNode?.operandId) {
      for (const output of scalarOutputs) {
        const value = result[output.name]
        if (value != null) {
          scene.setProperty(selectedNode.operandId, output.description, value)
        }
      }
    }
  }

  // Auto-hide inputs when operator produces new operand outputs
  if (shouldHideInputs(op)) {
    for (const nodeId of Object.values(inputNodes)) {
      scene.setVisible(nodeId, false)
    }
  }
}

function shouldHideInputs(op: Operator): boolean {
  if (op.hideInputs !== undefined) return op.hideInputs
  if (op.outputAsChild) return false
  const hasOperandOutputs = op.outputs.some((o) => (OPERAND_TYPES as readonly string[]).includes(o.type))
  const hasOperandInputs = op.inputs.some((i) => (OPERAND_TYPES as readonly string[]).includes(i.type))
  if (!hasOperandInputs) return false
  if (!hasOperandOutputs) return false
  return true
}
