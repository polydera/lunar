import { reactive } from 'vue'
import type { Operator, SceneOperator } from '@/core'
import { operands } from '@/core'
import { OPERAND_TYPES } from '@/core/operands'
import type { useScene } from '@/scene/useScene'
import type { useInputMapping } from '@/composables/useInputMapping'
import { useUIState } from '@/composables/useUIState'
import { listUIInputHandlers, type DeriveContext } from '@/ui/inputHandlers'

type Scene = ReturnType<typeof useScene>
type InputMapping = ReturnType<typeof useInputMapping>
type OpLike = Pick<Operator | SceneOperator, 'id' | 'inputs'>

/**
 * Sidecar dict: the values we last auto-seeded per sub-input key. Used for
 * customization detection — if `state[key] === derivedState[key]`, the user
 * hasn't touched the control since we last wrote it, so we can safely reseed.
 * Otherwise the user has customized, leave them alone.
 *
 * Module-global (like `useUIState`) so all callers share the same tracking.
 */
const derivedState = reactive<Record<string, unknown>>({})

/**
 * Build the DeriveContext for an operator from the current selection. Shared
 * by both `applyDerivedDefaults` (seed values) and ContextPanel's
 * `operatorControls` computed (slider config). Returns null if nothing
 * operand-related is resolvable (no selection, no handler-bearing op active).
 */
export function buildContext(op: OpLike, scene: Scene, inputMapping: InputMapping): DeriveContext | null {
  const entries = inputMapping.buildEntries(op)
  const operandsMap: Record<string, unknown> = {}
  const operandIds: Record<string, string> = {}
  let entryIdx = 0
  for (const inp of op.inputs) {
    if (!(OPERAND_TYPES as readonly string[]).includes(inp.type)) continue
    const entry = entries[entryIdx] ?? entries[0] // batch mode: all share entries[0]
    entryIdx++
    if (!entry) continue
    const parentNode = scene.getNode(entry.nodeId)
    if (!parentNode?.operandId) continue
    const parentOp = operands.get(parentNode.operandId)
    if (!parentOp) continue
    operandsMap[inp.name] = parentOp.data
    operandIds[inp.name] = parentNode.operandId
    if (inp.childInput && entry.selectedChild) {
      const childOp = operands.get(entry.selectedChild)
      if (childOp) {
        operandsMap[inp.childInput.name] = childOp.data
        operandIds[inp.childInput.name] = entry.selectedChild
      }
    }
  }
  const properties: Record<string, Record<string, unknown>> = {}
  for (const operandId of Object.values(operandIds)) {
    const p = scene.getProperties(operandId)
    if (p) properties[operandId] = p
  }
  return { operands: operandsMap, operandIds, properties }
}

/**
 * For every handler on `op`, compute fresh sub-input schemas via
 * `handler.inputs(ctx)` and reseed state[subKey] from the returned
 * `input.default` — but only if the user hasn't customized.
 *
 * Called when the active drill-in opens or when the selected child /
 * active selection changes.
 *
 * Customization detection (strategy C):
 *   - First derive for a key: always reseed (state holds a boot placeholder).
 *   - Later derives: reseed only if `state[subKey] === derivedState[subKey]`
 *     (the user hasn't touched the slider since our last write).
 */
export function applyDerivedDefaults(op: OpLike, scene: Scene, inputMapping: InputMapping): void {
  const handlers = listUIInputHandlers(op.id)
  if (!handlers) return
  const state = useUIState()
  const ctx = buildContext(op, scene, inputMapping)

  for (const [inputName, handler] of handlers) {
    for (const sub of handler.inputs(ctx)) {
      if (sub.default === undefined) continue
      const subKey = `${op.id}.${inputName}.${sub.name}`
      const currentValue = state[subKey]
      const lastSeeded = derivedState[subKey]
      const neverSeeded = lastSeeded === undefined
      const untouched = neverSeeded || currentValue === lastSeeded
      if (untouched) {
        state[subKey] = sub.default
        derivedState[subKey] = sub.default
      }
    }
  }
}
