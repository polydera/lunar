import { reactive } from 'vue'
import type { Operator, SceneOperator, ChildInput } from '@/core'
import { operands } from '@/core'
import { OPERAND_TYPES } from '@/core/operands'
import type { useScene } from '@/scene/useScene'

type Scene = ReturnType<typeof useScene>

export interface ChildEntry {
  nodeId: string
  operandId: string
  label: string
}

export interface MeshEntry {
  nodeId: string
  label: string
  childInput: ChildInput | undefined
  matchingChildren: ChildEntry[]
  selectedChild: string | null // operandId
}

/**
 * Anything with an `inputs` field — both Operator and SceneOperator satisfy this.
 * Used so `buildEntries` works uniformly for either.
 */
type HasInputs = Pick<Operator, 'inputs'> | Pick<SceneOperator, 'inputs'>

export function useInputMapping(scene: Scene) {
  const childSelection = reactive<Record<string, string>>({})

  /**
   * Build mapping entries from the current selection, using the given
   * operator or scene operator to determine which child inputs apply.
   *
   * For each selected operand node, resolves:
   *   - The applicable `childInput` spec (from the matching operand input on `op`)
   *   - Matching children in the scene tree (filtered by type + childInput.filter)
   *   - The currently selected child operand (from `childSelection`)
   */
  function buildEntries(op: HasInputs | null): MeshEntry[] {
    // Collect operand inputs from the operator / scene operator
    const operandInputs = op?.inputs.filter((i) => ['mesh', 'pointcloud', 'curves'].includes(i.type)) ?? []

    // Only include selected nodes with operand data
    const operandNodeIds = scene.activeSelection.filter((nodeId) => {
      const node = scene.getNode(nodeId)
      if (!node?.operandId) return false
      const o = operands.get(node.operandId)
      return !!o && (OPERAND_TYPES as readonly string[]).includes(o.type)
    })

    // Batch mode: single operand input + multiple selection → all entries share the same input spec
    const isBatch = operandInputs.length === 1 && operandNodeIds.length > 1

    return operandNodeIds.map((nodeId, i) => {
      const node = scene.getNode(nodeId)
      const label = node?.label ?? nodeId
      const inputSpec = isBatch ? operandInputs[0] : operandInputs[i]
      const childInput = inputSpec?.childInput

      let matchingChildren: ChildEntry[] = []
      if (childInput) {
        // Parent operand data (for the filter predicate)
        const parentOperand = node?.operandId ? operands.get(node.operandId) : null
        const parentData = parentOperand?.data

        const childIds = scene.getChildren(nodeId)
        matchingChildren = childIds
          .map((cid) => {
            const cn = scene.getNode(cid)
            if (!cn?.operandId) return null
            const co = operands.get(cn.operandId)
            if (co?.type !== childInput.type) return null
            // Runtime filter (e.g. "per-vertex only")
            if (childInput.filter && parentData !== undefined) {
              if (!childInput.filter(co.data, parentData)) return null
            }
            return { nodeId: cid, operandId: cn.operandId, label: cn.label }
          })
          .filter((c): c is NonNullable<typeof c> => c !== null)
      }

      // Validate / auto-select child
      let selectedChild = childSelection[nodeId] ?? null
      if (selectedChild && !matchingChildren.some((c) => c.operandId === selectedChild)) {
        selectedChild = null // stale selection
      }
      if (!selectedChild && matchingChildren.length > 0) {
        selectedChild = matchingChildren[0]!.operandId
      }

      return { nodeId, label, childInput, matchingChildren, selectedChild }
    })
  }

  function selectChild(meshNodeId: string, operandId: string) {
    childSelection[meshNodeId] = operandId
  }

  /**
   * Resolve the user's picked child operand ID for a mesh node, subject to
   * type + optional filter. If the user hasn't picked explicitly, returns
   * the first matching child's operandId (auto-select). Returns null if no
   * child matches.
   *
   * Used by the UI gatherer (in `useActions.gatherParamsFromUI`) to place an
   * operandId string into the shared params dict under `childInput.name` —
   * the same shape MCP sends natively. The resolver then looks up operand
   * data by ID, unified across UI and MCP paths.
   */
  function resolveChildId(
    meshNodeId: string,
    childType: string,
    filter?: (childData: unknown, parentData: unknown) => boolean,
  ): string | null {
    const childIds = scene.getChildren(meshNodeId)
    const selected = childSelection[meshNodeId]
    const parentNode = scene.getNode(meshNodeId)
    const parentOperand = parentNode?.operandId ? operands.get(parentNode.operandId) : null
    const parentData = parentOperand?.data

    for (const cid of childIds) {
      const cn = scene.getNode(cid)
      if (!cn?.operandId) continue
      const co = operands.get(cn.operandId)
      if (co?.type !== childType) continue
      if (filter && parentData !== undefined && !filter(co.data, parentData)) continue
      if (selected && cn.operandId === selected) return cn.operandId
      if (!selected) return cn.operandId
    }
    return null
  }

  return {
    buildEntries,
    selectChild,
    resolveChildId,
    childSelection,
  }
}
