import type { Input } from '@/core'

/**
 * Context passed to `UIInputHandler.inputs` when the user selects operands.
 * Lets handlers build sub-input schemas from live operand data — e.g.
 * isocontours `start/end` sliders with bounds from the selected scalar
 * array's min/max.
 *
 * - `operands`: operand data (tf.Mesh / tf.NDArray / tf.Curves), keyed by the
 *   operator's node-input name (e.g. `mesh`, `scalars`).
 * - `operandIds`: the underlying operandIds, keyed the same way. Use these to
 *   look up cached stats in `properties`.
 * - `properties`: the scene's property cache — mesh aabb/obb, ndarray stats.
 *   Prefer this over computing from `operands` directly to reuse cached work.
 *
 * `null` is passed at app boot and before any drill-in is open. Handlers
 * should return sensible fallback inputs when ctx is null.
 */
export interface DeriveContext {
  operands: Record<string, unknown>
  operandIds: Record<string, string>
  properties: Record<string, Record<string, unknown>>
}

/**
 * A `UIInputHandler` redirects the UI for a single operator input. The
 * operator's schema (`Input`) stays honest — that's what MCP sees. The
 * handler describes how the UI should present that input to humans:
 *
 * - `inputs(ctx)`: sub-inputs to render in place of the original control.
 *   A function so slider min/max/step/default can depend on operand data.
 *   Sub-input *names* must be stable across contexts (they key into state).
 * - `combine(subValues)`: reducer that maps sub-values back to the real
 *   input's value when the operator runs.
 *
 * See `src/core/operators/fields.ts` for example usage with `tf.isocontours`.
 */
export interface UIInputHandler {
  inputs: (ctx: DeriveContext | null) => Input[]
  combine: (subValues: Record<string, unknown>) => unknown
}

// (opId, inputName) → handler. Small nested Map for lookup without key fusion.
const registry = new Map<string, Map<string, UIInputHandler>>()

export function registerUIInputHandler(opId: string, inputName: string, handler: UIInputHandler): void {
  let byName = registry.get(opId)
  if (!byName) {
    byName = new Map()
    registry.set(opId, byName)
  }
  byName.set(inputName, handler)
}

export function getUIInputHandler(opId: string, inputName: string): UIInputHandler | undefined {
  return registry.get(opId)?.get(inputName)
}

export function listUIInputHandlers(opId: string): Map<string, UIInputHandler> | undefined {
  return registry.get(opId)
}
