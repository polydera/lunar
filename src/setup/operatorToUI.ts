import type { Input, Operator, Output } from '@/core'
import { OPERAND_TYPES } from '@/core/operands'
import type { UIAction, UISetup } from '@/types/ui'
import { button, column, property, slider, toggle, select } from '@/types/ui'
import { getUIInputHandler, type DeriveContext } from '@/ui/inputHandlers'

/** Minimal shape needed to build UI controls. Both Operator and SceneOperator satisfy it. */
type HasIdAndInputs = Pick<Operator, 'id' | 'inputs'>

/**
 * Build a single UI control for one scalar input, keyed by `idPrefix`.
 * Shared by the outer `operatorInputsToUI` (keys: `${op.id}.${input.name}`)
 * and the handler-expansion path (keys: `${op.id}.${input.name}.${sub.name}`).
 * Returns null for types that have no widget (operand inputs, unrecognized).
 */
function scalarInputToControl(input: Input, idPrefix: string): UIAction | null {
  const id = idPrefix
  if (input.type === 'number') {
    return slider({
      id,
      label: input.label,
      description: input.description,
      min: input.min,
      max: input.max,
      step: input.step,
    })
  }
  if (input.type === 'boolean') {
    return toggle({ id, label: input.label, description: input.description })
  }
  if (input.type === 'string' && input.enum) {
    return select({
      id,
      label: input.label,
      description: input.description,
      items: input.enum.map((e) => ({ label: e, value: e })),
    })
  }
  return null
}

/**
 * Generate UI controls from an operator / scene operator's scalar inputs.
 *
 * If an input has a registered `UIInputHandler` (see `src/ui/inputHandlers.ts`),
 * its sub-inputs render here in place of the original widget. The operator's
 * schema stays honest for MCP; the UI sugar lives in the handler registry.
 *
 * `ctx` is passed to `handler.inputs(ctx)` so slider min/max/step/default can
 * depend on the selected operand's data. Pass `null` when no operand context
 * is yet available (app boot, before a drill-in opens).
 */
export function operatorInputsToUI(op: HasIdAndInputs, ctx: DeriveContext | null = null): UIAction[] {
  const actions: UIAction[] = []

  for (const input of op.inputs) {
    if ((OPERAND_TYPES as readonly string[]).includes(input.type)) {
      continue
    }

    const handler = getUIInputHandler(op.id, input.name)
    if (handler) {
      // Render handler's sub-inputs in place of the original widget.
      // Keys: `${op.id}.${input.name}.${sub.name}` — namespaced under the
      // parent input so useActions can gather them for `combine()`.
      for (const sub of handler.inputs(ctx)) {
        const control = scalarInputToControl(sub, `${op.id}.${input.name}.${sub.name}`)
        if (control) actions.push(control)
      }
      continue
    }

    const control = scalarInputToControl(input, `${op.id}.${input.name}`)
    if (control) actions.push(control)
  }

  return actions
}

/** Generate property display items from an operator's scalar outputs */
export function operatorOutputsToProperties(op: Operator): UIAction[] {
  return op.outputs
    .filter((output) => !(OPERAND_TYPES as readonly string[]).includes(output.type))
    .map((output) => property({ label: output.label, value: '-' }))
}

/** Check if an output is an operand (goes to registry + scene) */
export function isOperandOutput(output: Output): boolean {
  return (OPERAND_TYPES as readonly string[]).includes(output.type)
}

/** Count how many operand inputs an operator needs (from active selection) */
export function countOperandInputs(op: Operator): number {
  return op.inputs.filter((input) => (OPERAND_TYPES as readonly string[]).includes(input.type)).length
}

/** Count how many operand outputs an operator produces (go to registry + scene) */
export function countOperandOutputs(op: Operator): number {
  return op.outputs.filter((output) => (OPERAND_TYPES as readonly string[]).includes(output.type)).length
}

/** Build a full operation panel for an operator: controls + run button */
export function operatorToOperation(op: Operator): { name: string; actions: UIAction[] } {
  const controls = operatorInputsToUI(op)
  return {
    name: op.label,
    actions: [
      column([...controls, button({ id: `${op.id}.run`, label: op.label, icon: 'i-hugeicons:play', isConfirm: true })]),
    ],
  }
}

/** Build a module from a group of operators */
export function operatorsToModule(name: string, value: string, icon: string, ops: Operator[]): UISetup['modules'][0] {
  const operations = ops.map(operatorToOperation)
  const properties = ops.flatMap(operatorOutputsToProperties)

  return {
    name,
    value,
    icon,
    operations,
    views: [],
    toolbar: [],
    properties: properties.length > 0 ? [column(properties)] : [],
  }
}
