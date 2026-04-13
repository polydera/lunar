import type { Operator, Input } from './types'
import type { SceneOperator } from './sceneOperatorRegistry'
import { OPERAND_TYPES } from './operands'

export type OperationMode =
  | { kind: 'ordered'; inputs: { name: string; label: string; type: string }[] }
  | { kind: 'batch'; input: { name: string; label: string; type: string } }
  | { kind: 'array'; input: { name: string; label: string; type: string } }
  | { kind: 'generator' }
  | { kind: 'insufficient'; needed: number; have: number }

function isOperandInput(input: Input): boolean {
  return (OPERAND_TYPES as readonly string[]).includes(input.type)
}

/** Anything with an `inputs` array — both Operator and SceneOperator satisfy this. */
type HasInputs = Pick<Operator, 'inputs'> | Pick<SceneOperator, 'inputs'>

function getOperandInputs(op: HasInputs): Input[] {
  return op.inputs.filter(isOperandInput)
}

/** Derive the operation mode from an operator or scene operator and current selection count. */
export function getOperationMode(op: HasInputs, selectionCount: number): OperationMode {
  const operandInputs = getOperandInputs(op)

  // No operand inputs → generator (sphere, box, etc.)
  if (operandInputs.length === 0) return { kind: 'generator' }

  // Single array input → array mode (requires at least 2 selections)
  const arrayInput = operandInputs.find((i) => i.array)
  if (arrayInput) {
    if (selectionCount < 2) return { kind: 'insufficient', needed: 2, have: selectionCount }
    return { kind: 'array', input: { name: arrayInput.name, label: arrayInput.label, type: arrayInput.type } }
  }

  // Single non-array input with multiple selection → batch
  if (operandInputs.length === 1 && selectionCount > 1) {
    const input = operandInputs[0]!
    return { kind: 'batch', input: { name: input.name, label: input.label, type: input.type } }
  }

  // Not enough selection for the operand inputs
  if (selectionCount < operandInputs.length) {
    return { kind: 'insufficient', needed: operandInputs.length, have: selectionCount }
  }

  // Ordered: N inputs, N+ selected
  return {
    kind: 'ordered',
    inputs: operandInputs.map((i) => ({ name: i.name, label: i.label, type: i.type })),
  }
}
