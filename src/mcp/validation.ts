import { operators, operands, sceneOperators } from '@/core'
import type { Input } from '@/core'
import type { HandlerContext, ActionDef } from './types'
import { splitInputs } from './discover'

function resolveOperand(id: string, ctxLabel: string, ctx: HandlerContext) {
  const node = ctx.scene.getNode(id)
  if (!node) throw new Error(`${ctxLabel}: node "${id}" not found`)
  const operand = node.operandId ? operands.get(node.operandId) : undefined
  if (!operand) throw new Error(`${ctxLabel}: node "${id}" has no operand`)
  return operand
}

function validateInputsAndParams(
  inputs: Input[],
  nodeIds: string[],
  params: Record<string, unknown>,
  label: string,
  ctx: HandlerContext,
) {
  const { nodes, params: paramInputs } = splitInputs(inputs)

  if (nodes.length > 0) {
    const isArray = nodes[0]?.array
    if (isArray) {
      if (nodeIds.length === 0) throw new Error(`${label} requires at least 1 input`)
    } else if (nodeIds.length !== nodes.length) {
      throw new Error(`${label} expects ${nodes.length} input(s), got ${nodeIds.length}`)
    }
  }

  for (let i = 0; i < Math.min(nodeIds.length, nodes.length); i++) {
    const operand = resolveOperand(nodeIds[i]!, label, ctx)
    if (!nodes[i]!.array && operand.type !== nodes[i]!.type) {
      throw new Error(`${label} input ${i} expects ${nodes[i]!.type}, got ${operand.type}`)
    }
  }

  for (const input of paramInputs) {
    const val = params[input.name]
    if (val === undefined) continue
    if (input.enum && !input.enum.includes(String(val))) {
      throw new Error(`${input.name}: invalid value "${val}", expected one of: ${input.enum.join(', ')}`)
    }
    if (input.type === 'number' && typeof val === 'number') {
      if (input.min !== undefined && val < input.min) throw new Error(`${input.name}: ${val} below minimum ${input.min}`)
      if (input.max !== undefined && val > input.max) throw new Error(`${input.name}: ${val} above maximum ${input.max}`)
    }
  }

  for (let i = 0; i < nodes.length; i++) {
    const node = nodes[i]!
    const child = node.childInput
    if (!child) continue
    const val = params[child.name]
    if (val === undefined || val === null) continue
    if (typeof val !== 'string') {
      throw new Error(`${child.name}: expected nodeId string, got ${typeof val}`)
    }
    const childOperand = resolveOperand(val, child.name, ctx)
    if (childOperand.type !== child.type) {
      throw new Error(`${child.name}: expected ${child.type}, got ${childOperand.type}`)
    }
    if (child.filter) {
      const parentId = nodeIds[i]
      if (!parentId) continue
      const parentOperand = resolveOperand(parentId, label, ctx)
      if (!child.filter(childOperand.data, parentOperand.data)) {
        throw new Error(`${child.name}: node "${val}" rejected by ${label} filter for input "${node.name}"`)
      }
    }
  }
}

export function validateOperation(
  op: { operatorId: string; nodeIds: string[]; params: Record<string, unknown> },
  ctx: HandlerContext,
  actionRegistry: Map<string, ActionDef>,
) {
  const { operatorId, nodeIds, params } = op

  for (const id of nodeIds) {
    if (!ctx.scene.getNode(id)) throw new Error(`Node not found: ${id}`)
  }

  const operator = operators.get(operatorId)
  if (operator) {
    validateInputsAndParams(operator.inputs, nodeIds, params, operator.label, ctx)
    return
  }

  const so = sceneOperators.get(operatorId)
  if (so) {
    validateInputsAndParams(so.inputs, nodeIds, params, so.label, ctx)
    return
  }

  const action = actionRegistry.get(operatorId)
  if (action) {
    if (action.usesNodeIds === true && nodeIds.length === 0) {
      throw new Error(`${action.label} requires at least 1 nodeId`)
    }
    validateInputsAndParams(action.inputs, nodeIds, params, action.label, ctx)
    return
  }

  throw new Error(`Unknown operator: ${operatorId}`)
}
