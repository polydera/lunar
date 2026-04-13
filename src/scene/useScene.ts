import { computed, reactive, triggerRef, shallowRef } from 'vue'
import * as tf from '@polydera/trueform'
import type { MeshObject } from '@/utils/tree'
import { operands, sceneOperators } from '@/core'
import { computeNDArrayStats } from '@/core/ndarrayStats'
import { computeCurvesStats } from '@/core/curvesStats'

/**
 * Per-scene-operator state bag on a node.
 *
 * Keyed by `sceneOperator.id`, the value is the opaque args record that the
 * scene operator wrote via its `apply` and reads back via its `read`.
 *
 * The scene doesn't interpret the contents — each scene operator owns its
 * own schema. The viewport reads specific keys when it needs rendering state
 * (e.g. `'style.colorByArray'` → vertex color source).
 */
export type SceneOperatorState = Record<string, Record<string, unknown>>

export interface SceneNode {
  id: string
  label: string
  parentId: string | null
  order: number
  operandId?: string
  visible: boolean
  pickable?: boolean // defaults to true
  color: string
  opacity: number
  renderMode: 'solid' | 'wireframe' | 'points'
  sceneOperatorState?: SceneOperatorState
}

export function useScene() {
  // Self reference — populated just before `return`. Needed so functions
  // defined here can pass the scene API to scene operator hooks without
  // restating the type. By the time any external caller invokes these
  // functions (via the returned object), `sceneApi` is assigned.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let sceneApi: any = null

  // Primary storage — plain maps, no reactivity overhead
  const nodes = new Map<string, SceneNode>()
  const children = new Map<string | null, string[]>()

  // Active selection — ordered, reactive for UI, for mapping to operator inputs
  const activeSelection = reactive<string[]>([])

  // Hovered node — set by viewport on mouse move, reactive for UI
  const hoveredNode = ref<string | null>(null)

  // Dirty tracking — viewport reads and clears this
  const dirty = new Set<string>()

  // Properties — plain object, per-operand computed metadata (face count, area, aabb, etc.)
  const properties: Record<string, Record<string, unknown>> = {}

  // Version counter — bumped on structural changes so Vue computed reacts
  const version = shallowRef(0)
  function bump() {
    triggerRef(version)
  }

  // ── Mutators ───────────────────────────────────────────

  function uniqueLabel(label: string, parentId: string | null): string {
    const siblingIds = children.get(parentId) ?? []
    const siblingLabels = siblingIds.map((id) => nodes.get(id)?.label).filter(Boolean)
    if (!siblingLabels.includes(label)) return label
    let i = 2
    while (siblingLabels.includes(`${label} ${i}`)) i++
    return `${label} ${i}`
  }

  /**
   * Compute and cache properties for an operand. For meshes: faces, vertices,
   * aabb (sync) and obb (dispatched async). For ndarrays: shape + min/max/mean/
   * std stats via WASM reductions.
   *
   * Called from `addNode` on fresh operands and from the preview-commit path
   * when an operand's data has been replaced during a live preview. Safe to
   * call on any operand type — no-op for unsupported types.
   */
  function computeProperties(operandId: string) {
    const operand = operands.get(operandId)
    if (!operand) return
    if (operand.type === 'mesh') {
      const mesh = operand.data as tf.Mesh
      properties[operandId] = {
        faces: mesh.numberOfFaces,
        vertices: mesh.numberOfPoints,
        aabb: tf.aabbFrom(mesh),
      }
      // OBB is more expensive — compute async
      tf.async.obbFrom(mesh).then((obb) => {
        if (properties[operandId]) {
          properties[operandId].obb = obb
          bump()
        }
      })
    } else if (operand.type === 'ndarray') {
      // Stats cached on add. Single source of truth for both the UI (seeding
      // sliders from min/max) and MCP (bot reasoning about threshold values
      // via world_state).
      properties[operandId] = {
        ...computeNDArrayStats(operand.data as tf.NDArray),
      }
    } else if (operand.type === 'curves') {
      // paths, points, aabb, totalLength — computed via WASM (take + sub +
      // norm(axis) + sum), so no JS loops over the edge buffer.
      properties[operandId] = {
        ...computeCurvesStats(operand.data as tf.Curves),
      }
    }
  }

  /**
   * Drop the cached properties for an operand. Called automatically from
   * `operands.replaceData` — the underlying data is in flux (e.g. generator
   * slider drag), so whatever we cached is now stale. Readers must handle
   * `getProperties(id)` returning undefined; the property set is repopulated
   * by `computeProperties` on the next commit.
   */
  function invalidateProperties(operandId: string) {
    delete properties[operandId]
    bump()
  }

  function addNode(node: SceneNode) {
    if (node.pickable === undefined) node.pickable = true
    node.label = uniqueLabel(node.label, node.parentId)
    nodes.set(node.id, node)
    const siblings = children.get(node.parentId) ?? []
    siblings.push(node.id)
    children.set(node.parentId, siblings)
    dirty.add(node.id)

    if (node.operandId) computeProperties(node.operandId)

    bump()
  }

  function removeNode(id: string) {
    const node = nodes.get(id)
    if (!node) return

    const childIds = children.get(id) ?? []
    for (const childId of [...childIds]) {
      removeNode(childId)
    }

    // Clean up operand
    let removedOperandId: string | undefined
    if (node.operandId) {
      const operand = operands.get(node.operandId)
      if (operand) {
        const tfObj = operand.data as any
        if (tfObj?.delete) tfObj.delete()
        operands.remove(node.operandId)
        removedOperandId = node.operandId
      }
    }

    // Notify scene operators that a referenced operand is being removed so
    // they can clear dangling references in their per-node state bags.
    if (removedOperandId && sceneApi) {
      for (const so of sceneOperators.all()) {
        if (!so.onOperandRemoved) continue
        for (const other of nodes.values()) {
          if (other.id === id) continue
          so.onOperandRemoved(other.id, removedOperandId, sceneApi)
        }
      }
    }

    const siblings = children.get(node.parentId)
    if (siblings) {
      const idx = siblings.indexOf(id)
      if (idx !== -1) siblings.splice(idx, 1)
    }

    children.delete(id)
    nodes.delete(id)
    delete properties[id]
    const selIdx = activeSelection.indexOf(id)
    if (selIdx !== -1) activeSelection.splice(selIdx, 1)
    dirty.add(id)
    bump()
  }

  function moveNode(id: string, newParentId: string | null) {
    const node = nodes.get(id)
    if (!node) return

    const oldSiblings = children.get(node.parentId)
    if (oldSiblings) {
      const idx = oldSiblings.indexOf(id)
      if (idx !== -1) oldSiblings.splice(idx, 1)
    }

    const newSiblings = children.get(newParentId) ?? []
    newSiblings.push(id)
    children.set(newParentId, newSiblings)

    node.parentId = newParentId
    dirty.add(id)
    bump()
  }

  function setLabel(id: string, label: string) {
    const node = nodes.get(id)
    if (node) {
      node.label = label
      bump()
    }
  }

  function setTransform(id: string, transform: Float32Array | null) {
    const node = nodes.get(id)
    if (!node?.operandId) return
    const operand = operands.get(node.operandId)
    if (!operand) return
    const tfObj = operand.data as any
    if (transform) {
      tfObj.transformation = transform
    } else {
      tfObj.transformation = null
    }
    dirty.add(id)
  }

  function isVisualNode(node: SceneNode): boolean {
    if (!node.operandId) return false
    const op = operands.get(node.operandId)
    return !!op && (op.type === 'mesh' || op.type === 'curves')
  }

  function setVisible(id: string, visible: boolean) {
    const node = nodes.get(id)
    if (!node) return

    // Can't make a child visible if its visual parent is hidden
    if (visible && node.parentId) {
      const parent = nodes.get(node.parentId)
      if (parent && !parent.visible && isVisualNode(parent)) return
    }

    node.visible = visible
    dirty.add(id)

    // Cascade to all descendants
    function cascadeDown(parentId: string) {
      const childIds = children.get(parentId) ?? []
      for (const childId of childIds) {
        const child = nodes.get(childId)
        if (child) {
          child.visible = visible
          dirty.add(childId)
        }
        cascadeDown(childId)
      }
    }
    cascadeDown(id)

    bump()
  }

  function toggleVisible(id: string) {
    const node = nodes.get(id)
    if (!node) return

    const childIds = children.get(id) ?? []
    if (childIds.length > 0) {
      const allVisible = allDescendantsMatch(id, true)
      const allHidden = allDescendantsMatch(id, false)
      if (allVisible) {
        setVisible(id, false)
      } else {
        // indeterminate or all hidden → show all
        setVisible(id, true)
      }
    } else {
      setVisible(id, !node.visible)
    }
  }

  function allDescendantsMatch(id: string, value: boolean): boolean {
    const node = nodes.get(id)
    if (!node) return true
    if (node.visible !== value) return false
    const childIds = children.get(id) ?? []
    return childIds.every((childId) => allDescendantsMatch(childId, value))
  }

  function setColor(id: string, color: string) {
    const node = nodes.get(id)
    if (node) {
      node.color = color
      // Clear array coloring when user picks a solid color
      if (node.sceneOperatorState?.['style.colorByArray']) {
        delete node.sceneOperatorState['style.colorByArray']
      }
      dirty.add(id)
      bump()
    }
  }

  function setRenderMode(id: string, mode: 'solid' | 'wireframe' | 'points') {
    const node = nodes.get(id)
    if (node) {
      node.renderMode = mode
      dirty.add(id)
      bump()
    }
  }

  function setOpacity(id: string, opacity: number) {
    const node = nodes.get(id)
    if (node) {
      node.opacity = opacity
      dirty.add(id)
      bump()
    }
  }

  // ── Scene operator state ───────────────────────────────
  //
  // Scene operators store their per-node state here, keyed by `sceneOperator.id`.
  // The scene doesn't interpret the contents — it just writes/reads/clears.

  function setSceneOperatorArgs(nodeId: string, soId: string, args: Record<string, unknown>) {
    const node = nodes.get(nodeId)
    if (!node) return
    if (!node.sceneOperatorState) node.sceneOperatorState = {}
    node.sceneOperatorState[soId] = args
    dirty.add(nodeId)
    bump()
  }

  function getSceneOperatorArgs(nodeId: string, soId: string): Record<string, unknown> | undefined {
    return nodes.get(nodeId)?.sceneOperatorState?.[soId]
  }

  function clearSceneOperatorArgs(nodeId: string, soId: string) {
    const node = nodes.get(nodeId)
    if (!node?.sceneOperatorState) return
    if (soId in node.sceneOperatorState) {
      delete node.sceneOperatorState[soId]
      dirty.add(nodeId)
      bump()
    }
  }

  // ── Selection ────────────────────────────────────────────

  function select(id: string, add = false) {
    if (!add) activeSelection.length = 0
    if (!activeSelection.includes(id)) {
      activeSelection.push(id)
    }
    bump()
  }

  function deselect(id: string) {
    const idx = activeSelection.indexOf(id)
    if (idx !== -1) activeSelection.splice(idx, 1)
    bump()
  }

  function handleSelect(id: string, add: boolean) {
    if (add) {
      if (activeSelection.includes(id)) {
        deselect(id)
      } else {
        select(id, true)
      }
    } else {
      if (activeSelection.length === 1 && activeSelection[0] === id) {
        clearSelection()
      } else {
        clearSelection()
        select(id, true)
      }
    }
  }

  function clearSelection() {
    activeSelection.length = 0
    bump()
  }

  // ── Properties ───────────────────────────────────────────

  function setProperty(operandId: string, key: string, value: unknown) {
    if (!properties[operandId]) properties[operandId] = {}
    properties[operandId][key] = value
    bump()
  }

  function getProperties(operandId: string): Record<string, unknown> | undefined {
    return properties[operandId]
  }

  // ── Reads ──────────────────────────────────────────────

  function getNode(id: string): SceneNode | undefined {
    return nodes.get(id)
  }

  function getChildren(id: string | null): string[] {
    return children.get(id) ?? []
  }

  // ── Dirty set — consumed by viewport ───────────────────

  function consumeDirty(): Set<string> {
    if (dirty.size === 0) return dirty
    const snapshot = new Set(dirty)
    dirty.clear()
    return snapshot
  }

  // ── UI tree ────────────────────────────────────────────

  const tree = computed<MeshObject[]>(() => {
    // eslint-disable-next-line @typescript-eslint/no-unused-expressions
    version.value
    function buildTree(parentId: string | null): MeshObject[] {
      const childIds = children.get(parentId) ?? []
      return childIds.map((id) => {
        const n = nodes.get(id)!
        const childTree = buildTree(n.id)

        const visual = n.operandId ? isVisualNode(n) : false

        let isVisible: boolean | 'indeterminate' = n.visible
        if (childTree.length > 0) {
          // Include own visibility if this node is visual (mesh/curves)
          const states: (boolean | 'indeterminate')[] = childTree.map((c) => c.isVisible ?? true)
          if (visual) states.push(n.visible)

          const allVisible = states.every((s) => s === true)
          if (allVisible) isVisible = true
          else if (states.every((s) => s === false)) isVisible = false
          else isVisible = 'indeterminate'
        }

        return {
          label: n.label,
          value: n.id,
          isVisual: visual,
          isVisible,
          color: n.color,
          opacity: n.opacity,
          children: childTree,
        }
      })
    }
    return buildTree(null)
  })

  const api = {
    nodes,
    activeSelection,
    hoveredNode,
    dirty,
    properties,
    tree,
    version,
    addNode,
    removeNode,
    moveNode,
    setLabel,
    setTransform,
    setVisible,
    toggleVisible,
    setColor,
    setOpacity,
    setRenderMode,
    setSceneOperatorArgs,
    getSceneOperatorArgs,
    clearSceneOperatorArgs,
    select,
    deselect,
    clearSelection,
    handleSelect,
    setProperty,
    getProperties,
    computeProperties,
    invalidateProperties,
    getNode,
    getChildren,
    consumeDirty,
  }
  sceneApi = api
  return api
}
