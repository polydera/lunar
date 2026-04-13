import type { InjectionKey, Ref } from 'vue'
import type { SceneOperator } from '@/core'
import type { useScene } from '@/scene/useScene'

type Scene = ReturnType<typeof useScene>

/**
 * Abstraction over "where a control's current value lives".
 *
 * Operator controls use the global `useUIState` store (no bag).
 * SceneOperator controls use a scene-derived bag: reads walk the selection
 * via `sceneOperator.read(nodeId, ...)` and writes call `apply(nodeId, ...)`.
 */
export interface StateBag {
  /** Get the current value for the given `${opId}.${inputName}` key. */
  get(id: string): unknown
  /** Write a new value. Bag decides where it lands (scene nodes, global state, etc). */
  set(id: string, value: unknown): void
}

/** Vue inject key for the optional current state bag. */
export const STATE_BAG_KEY = Symbol('stateBag') as InjectionKey<Ref<StateBag | null>>

/** Sentinel returned when selected nodes disagree on a scalar param. */
export const MIXED = Symbol('mixed')

/**
 * Build a state bag that reads/writes a scene operator's params across the
 * currently selected scene nodes.
 *
 *  get(id):
 *    - id is `${sceneOperator.id}.${inputName}` (matches operatorInputsToUI output)
 *    - reads inputName from each selected node via sceneOperator.read()
 *    - returns the unanimous value, or `undefined` when mixed
 *
 *  set(id, value):
 *    - for each selected node, merges the new value into the current read()
 *    - calls sceneOperator.apply() with the merged args
 *
 * Per-mesh operand child selections (e.g. the `array` child input on
 * Color by Array) are NOT read/written through this bag — those are per-node
 * and handled by the inline child dropdown in the operand list, which calls
 * `sceneOperator.apply` directly with the new child id.
 */
export function createSceneOperatorStateBag(sceneOperator: SceneOperator, scene: Scene): StateBag {
  const prefix = `${sceneOperator.id}.`

  function inputName(id: string): string {
    return id.startsWith(prefix) ? id.slice(prefix.length) : id
  }

  return {
    get(id: string): unknown {
      // Track reactivity: bump on any scene mutation, and on selection change.
      // eslint-disable-next-line @typescript-eslint/no-unused-expressions
      scene.version.value
      const name = inputName(id)
      let first: unknown = undefined
      let hasValue = false
      for (const nodeId of scene.activeSelection) {
        const node = scene.getNode(nodeId)
        if (!node) continue
        const values = sceneOperator.read(nodeId, scene)
        const v = values[name]
        if (!hasValue) {
          first = v
          hasValue = true
        } else if (v !== first) {
          return undefined // mixed
        }
      }
      return hasValue ? first : undefined
    },
    set(id: string, value: unknown): void {
      const name = inputName(id)
      for (const nodeId of scene.activeSelection) {
        const node = scene.getNode(nodeId)
        if (!node) continue
        const current = sceneOperator.read(nodeId, scene)
        sceneOperator.apply(nodeId, { ...current, [name]: value }, scene)
      }
    },
  }
}
