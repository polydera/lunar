import { operators, sceneOperators } from '@/core'
import { OPERAND_TYPES } from '@/core/operands'
import type { Operator, SceneOperator, Input } from '@/core'
import type { ActionDef } from './types'

function splitInputs(inputs: Input[]) {
  const nodes: Input[] = []
  const params: Input[] = []
  for (const i of inputs) {
    if ((OPERAND_TYPES as readonly string[]).includes(i.type)) nodes.push(i)
    else params.push(i)
  }
  return { nodes, params }
}

export { splitInputs }

function compactParamName(input: Input): string {
  if (input.childInput) return `${input.childInput.name} →node`
  return input.name
}

function serializeOperatorDetail(op: Operator) {
  const { nodes, params } = splitInputs(op.inputs)

  const serializedNodes = nodes.map((i) => ({
    name: i.name,
    type: i.type,
    array: i.array || undefined,
    description: i.array
      ? `Pass all ${i.type} IDs in nodeIds`
      : nodes.length > 1
        ? `${i.label} → nodeIds[${nodes.indexOf(i)}]`
        : `Pass ${i.type} ID in nodeIds[0]`,
  }))

  const serializedParams = params.map((i) => {
    const p: Record<string, unknown> = { name: i.name, type: i.type, description: i.description }
    if (i.default !== undefined) p.default = i.default
    if (i.min !== undefined) p.min = i.min
    if (i.max !== undefined) p.max = i.max
    if (i.step !== undefined) p.step = i.step
    if (i.enum) p.enum = i.enum
    return p
  })

  for (const n of nodes) {
    if (n.childInput) {
      serializedParams.push({
        name: n.childInput.name,
        type: 'nodeId',
        description: `ID of a child ${n.childInput.type} node on ${n.name} (from world_state)`,
        ...(n.childInput.optional ? { default: null } : {}),
      })
    }
  }

  const example: Record<string, unknown> = { operatorId: op.id }
  if (nodes.length > 0) {
    example.nodeIds = nodes[0]!.array ? ['<id1>', '<id2>', '...'] : nodes.map((n) => `<${n.name}-id>`)
  }
  const exampleParams: Record<string, unknown> = {}
  for (const p of params) {
    if (p.default !== undefined) exampleParams[p.name] = p.default
  }
  for (const n of nodes) {
    if (n.childInput) exampleParams[n.childInput.name] = `<${n.childInput.type}-child-id>`
  }
  if (Object.keys(exampleParams).length > 0) example.params = exampleParams

  return {
    id: op.id,
    label: op.label,
    description: op.description,
    category: op.category,
    docsUrl: op.docsUrl,
    nodes: serializedNodes,
    params: serializedParams,
    outputs: op.outputs.map((o) => ({
      name: o.name,
      type: o.type,
      primary: o.primary || undefined,
      array: o.array || undefined,
    })),
    _example: example,
  }
}

function serializeSceneOperatorDetail(so: SceneOperator) {
  const { nodes, params } = splitInputs(so.inputs)
  const serializedParams = params.map((i) => {
    const p: Record<string, unknown> = {
      name: i.childInput ? i.childInput.name : i.name,
      type: i.childInput ? 'nodeId' : i.type,
      description: i.childInput ? `ID of a child ${i.childInput.type} node from world_state` : i.description,
    }
    if (i.default !== undefined) p.default = i.default
    if (i.min !== undefined) p.min = i.min
    if (i.max !== undefined) p.max = i.max
    if (i.enum) p.enum = i.enum
    return p
  })
  for (const n of nodes) {
    if (n.childInput)
      serializedParams.push({
        name: n.childInput.name,
        type: 'nodeId',
        description: `ID of a child ${n.childInput.type} node on ${n.name} (from world_state)`,
        ...(n.childInput.optional ? { default: null } : {}),
      })
  }
  const exampleParams: Record<string, unknown> = {}
  for (const p of serializedParams) {
    if (p.default !== undefined) exampleParams[p.name as string] = p.default
    if (p.type === 'nodeId') exampleParams[p.name as string] = `<${p.name as string}-child-id>`
  }
  return {
    id: so.id,
    label: so.label,
    description: so.description,
    category: so.category,
    docsUrl: so.docsUrl,
    nodes: nodes.map((i) => ({ name: i.name, type: i.type, description: `Target ${i.type} → nodeId` })),
    params: serializedParams,
    _example: {
      operatorId: so.id,
      nodeId: `<${nodes[0]?.name ?? 'node'}-id>`,
      params: Object.keys(exampleParams).length > 0 ? exampleParams : undefined,
    },
  }
}

function serializeActionDetail(def: ActionDef) {
  const { nodes, params } = splitInputs(def.inputs)

  const serializedParams = params.map((i) => {
    const p: Record<string, unknown> = { name: i.name, type: i.type, description: i.description }
    if (i.default !== undefined) p.default = i.default
    if (i.min !== undefined) p.min = i.min
    if (i.max !== undefined) p.max = i.max
    if (i.step !== undefined) p.step = i.step
    if (i.enum) p.enum = i.enum
    return p
  })

  for (const n of nodes) {
    if (n.childInput) {
      serializedParams.push({
        name: n.childInput.name,
        type: 'nodeId',
        description: `ID of a child ${n.childInput.type} node on ${n.name} (from world_state)`,
        ...(n.childInput.optional ? { default: null } : {}),
      })
    }
  }

  const example: Record<string, unknown> = { operatorId: def.id }
  if (def.usesNodeIds) example.nodeIds = ['<node-id>']
  const ep: Record<string, unknown> = {}
  for (const p of serializedParams) {
    if (p.default !== undefined) ep[p.name as string] = p.default
    else if (p.enum) ep[p.name as string] = (p.enum as string[])[0]
    else if (p.type === 'array') ep[p.name as string] = (p.name as string) === 'nodeIds' ? ['<id1>', '<id2>'] : [1, 0, 0]
    else if (p.type === 'string') ep[p.name as string] = `<${p.name}>`
    else if (p.type === 'number') ep[p.name as string] = (p.name as string) === 'degrees' ? 90 : (p.name as string) === 'factor' ? 2 : 1
    else if (p.type === 'boolean') ep[p.name as string] = true
  }
  if (Object.keys(ep).length > 0) example.params = ep
  return {
    id: def.id,
    label: def.label,
    description: def.description,
    category: def.category,
    params: serializedParams,
    _example: example,
  }
}

function resolveOperatorDetail(id: string, actionRegistry: Map<string, ActionDef>) {
  const op = operators.get(id)
  if (op) return serializeOperatorDetail(op)
  const so = sceneOperators.get(id)
  if (so) return serializeSceneOperatorDetail(so)
  const action = actionRegistry.get(id)
  if (action) return serializeActionDetail(action)
  throw new Error(`Operator not found: ${id}`)
}

export function handleDiscover(params: Record<string, unknown>, actionRegistry: Map<string, ActionDef>) {
  const ids = (params.operatorIds ?? (params.operatorId ? [params.operatorId] : null)) as string[] | null
  if (ids && ids.length > 0) {
    return ids.map((id) => resolveOperatorDetail(id, actionRegistry))
  }

  const cats = (params.categories ?? (params.category ? [params.category] : null)) as string[] | null
  if (cats && cats.length > 0) {
    return cats.flatMap((cat) => [
      ...operators
        .all()
        .filter((op) => op.category === cat)
        .map(serializeOperatorDetail),
      ...sceneOperators
        .all()
        .filter((so) => so.category === cat)
        .map(serializeSceneOperatorDetail),
      ...[...actionRegistry.values()].filter((a) => a.category === cat).map(serializeActionDetail),
    ])
  }

  const groups: Record<string, unknown[]> = {}

  for (const op of operators.all()) {
    const { nodes, params: scalarParams } = splitInputs(op.inputs)
    const isArray = nodes.some((i) => i.array)
    const entry: Record<string, unknown> = { id: op.id, l: op.label }
    if (nodes.length > 0) entry.n = isArray ? 'N' : nodes.length
    const pNames = scalarParams.map((i) => compactParamName(i))
    if (pNames.length > 0) entry.p = pNames
    if (!groups[op.category]) groups[op.category] = []
    groups[op.category]!.push(entry)
  }

  for (const so of sceneOperators.all()) {
    const { nodes, params: scalarParams } = splitInputs(so.inputs)
    const entry: Record<string, unknown> = { id: so.id, l: so.label }
    if (nodes.length > 0) entry.n = 1
    const pNames = scalarParams.map((i) => compactParamName(i))
    if (pNames.length > 0) entry.p = pNames
    if (!groups[so.category]) groups[so.category] = []
    groups[so.category]!.push(entry)
  }

  for (const def of actionRegistry.values()) {
    const { params: scalarParams } = splitInputs(def.inputs)
    const entry: Record<string, unknown> = { id: def.id, l: def.label }
    if (def.usesNodeIds) entry.n = def.usesNodeIds === 'optional' ? '0+' : 1
    const pNames = scalarParams.map((i) => compactParamName(i))
    if (pNames.length > 0) entry.p = pNames
    if (!groups[def.category]) groups[def.category] = []
    groups[def.category]!.push(entry)
  }

  return {
    _guide:
      'Fields: id=operator ID, l=label, n=mesh inputs via nodeIds (1=one mesh, 2=two ordered, N=variable, 0+=optional/uses selection, absent=no inputs i.e. generators), p=parameter names. Call discover({ operatorIds: [...] }) for full schema + example before using any operator.',
    ...groups,
  }
}
