import type { Input } from './types'
import type { useScene } from '@/scene/useScene'

type Scene = ReturnType<typeof useScene>

/**
 * A SceneOperator mutates visual/render state on existing scene nodes.
 *
 * Parallel to Operator:
 *   - Operator:       produces new data; triggered by Run; writes new operands/nodes.
 *   - SceneOperator:  mutates scene node state; live; no Run button; no new nodes.
 *
 * Shares the same `Input` type as operators (so it reuses the UI widgets, the
 * operand list, and the `childInput` filtering). The execution contract differs:
 * `apply` writes to a scene node, `read` extracts current values back.
 *
 * Batch semantics: when multiple nodes are selected, `apply` is called once per
 * node. `read` is called per node and the caller reconciles the values ("mixed"
 * when selected nodes disagree on a scalar param).
 */
export interface SceneOperator {
  id: string
  label: string
  description: string
  category: string
  tags: string[]
  inputs: Input[]
  /**
   * Apply a full set of param values to a single scene node.
   * `args` is keyed by input `name`. Per-node operand child selections
   * are included as their input name → operandId (or null for "none").
   */
  apply(nodeId: string, args: Record<string, unknown>, scene: Scene): void
  /**
   * Read current param values back from a scene node. Used by the UI to
   * populate controls when selection or node state changes.
   */
  read(nodeId: string, scene: Scene): Record<string, unknown>
  /**
   * Optional: called when an operand is being removed from the scene. Gives
   * the scene operator a chance to clear stale operand-id references stored
   * in its state for the given node.
   *
   * The scene's `removeNode` dispatches this to every scene operator × every
   * surviving node when an operand is about to be deleted.
   */
  onOperandRemoved?(nodeId: string, removedOperandId: string, scene: Scene): void
  /** URL to the trueform documentation for this scene operator's underlying function(s). */
  docsUrl?: string
}

export class SceneOperatorRegistry {
  private items = new Map<string, SceneOperator>()

  register(so: SceneOperator): void {
    this.items.set(so.id, so)
  }

  get(id: string): SceneOperator | undefined {
    return this.items.get(id)
  }

  all(): SceneOperator[] {
    return [...this.items.values()]
  }

  byCategory(category: string): SceneOperator[] {
    return this.all().filter((so) => so.category === category)
  }

  search(query: string): SceneOperator[] {
    const q = query.toLowerCase()
    return this.all().filter(
      (so) =>
        so.id.toLowerCase().includes(q) ||
        so.label.toLowerCase().includes(q) ||
        so.description.toLowerCase().includes(q) ||
        so.tags.some((t) => t.toLowerCase().includes(q)),
    )
  }
}

export const sceneOperators = new SceneOperatorRegistry()
