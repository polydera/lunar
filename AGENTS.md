# Lunar — Architecture & Developer Guide

Lunar is a browser-based geometry processing app. Vue 3 + Three.js + trueform (WASM). Hosted on Cloudflare Workers. AI-controllable via MCP.

## Directory Structure

```
src/
  core/           Operator definitions, registries, types, operands, ndarrayStats
  composables/    Reactive logic (useActions, operatorExecutor, useDispatcher, useReport, useDerivedDefaults, etc.)
  components/     Vue components (ContextPanel, ObjectList, TaskPanel, etc.)
  scene/          Scene graph (useScene — nodes, selection, dirty tracking, property cache)
  viewport/       Three.js renderer, camera, interaction, scene sync
  mcp/            MCP handler, WebSocket bridge, tool schemas, instructions
  setup/          Categories, theme defaults, operator→UI conversion
  ui/             UI-only helpers (input handler registry for schema-divergence sugar)
  assets/         CSS (theme.css with --ln-* tokens, main.css with @theme)
functions/
  worker.ts       Cloudflare Worker entry (routes /mcp/* → DO, serves SPA)
  mcp-session.ts  Durable Object (bridges MCP clients ↔ browser via WebSocket)
mcp/
  bridge.ts       Local dev stdio MCP bridge (not used in production)
```

## The Registration → UI → MCP Chain

Everything in Lunar flows from **definitions** to **UI** and **MCP** automatically. Understanding this chain is key.

### Step 1: Define an Operator

In `src/core/operators/<category>.ts`, you register an operator with a schema:

```typescript
operators.register({
  id: 'tf.myOperator',
  label: 'My Operator',
  description: 'What it does.',
  category: 'geometry',
  tags: ['search', 'terms'],
  inputs: [
    { name: 'mesh', label: 'Mesh', type: 'mesh', description: 'Input mesh' },
    { name: 'amount', label: 'Amount', type: 'number', default: 1, min: 0, max: 10, step: 0.1 },
  ],
  outputs: [
    { name: 'mesh', label: 'Mesh', type: 'mesh', primary: true },
  ],
  sync: ({ mesh, amount }) => ({ mesh: tf.myFunction(mesh, amount) }),
  async: async ({ mesh, amount }) => ({ mesh: await tf.async.myFunction(mesh, amount) }),
})
```

### Step 2: Add to a Category

In `src/setup/categories.ts`, add the operator to a category:

```typescript
{ type: 'operator', operator: operators.get('tf.myOperator')! },
```

### What Happens Automatically

**UI generation** (`src/setup/operatorToUI.ts`):
- Each scalar input (number, string, boolean) becomes a UI control
- `number` with `min`/`max` → slider. `string` with `enum` → dropdown. `boolean` → toggle.
- Controls are keyed as `${op.id}.${input.name}` in UIState (a global reactive dict)
- Operand inputs (mesh, curves, etc.) are NOT controls — they come from scene selection

**Context panel** (`src/components/ContextPanel.vue`):
- Category appears as an icon in the left icon bar
- Clicking it shows the operator list
- Clicking an operator opens a **drill-in** panel showing:
  - Operands section (which meshes are selected and in what order)
  - Generated scalar controls (sliders, dropdowns, toggles)
  - Run button (calls `runAction('tf.myOp.run')`)

**Command palette** (Cmd+K):
- All operators appear in search results automatically

**MCP discover**:
- `discover()` returns the operator in the compact catalog under its category
- `discover({ operatorId: 'tf.myOperator' })` returns full schema + example call
- `run({ operations: [{ operatorId: 'tf.myOperator', nodeIds: [...], params: {...} }] })` executes it

**Validation** (`validateOperation()` in handler.ts):
- Checks nodeIds exist in scene
- Dispatches to `validateInputsAndParams(inputs, nodeIds, params, label)` for both operators **and** scene operators — same `Input[]` schema, same checks, no duplication
- Input count matches schema (respecting `array: true`)
- Operand types match `input.type`
- Scalar params: `enum` membership, `min`/`max` ranges
- `childInput` resolution: if a value is passed under `childInput.name`, the nodeId must resolve to an operand of the right type, and `childInput.filter(childData, parentData)` must pass (same filter the UI uses for the child-operand dropdown)
- Actions get a lighter check: `usesNodeIds` count only

Add a new field to `Input` → both operator and scene operator validation picks it up automatically.

## Three Types of "Operators"

### 1. Regular Operators (create data)

**Registry**: `operators` (OperatorRegistry in `src/core/registry.ts`)
**UI**: Drill-in with operands + controls + Run button
**Execution**: two entry points, one pure pipeline — see [Operator Execution Path](#operator-execution-path)
**Result**: New scene nodes created from outputs

Operators define both `sync` and `async` functions:
- `sync` is used for **live generator preview** (instant feedback while dragging sliders)
- `async` is used for **actual execution** (Run button, MCP calls)

**Operation modes** (determined by input types + selection count):
- **Generator**: no operand inputs (sphere, box) — creates from nothing
- **Single**: 1 mesh input, 1 selected — applies to that mesh
- **Batch**: 1 mesh input, N selected — runs once per mesh in parallel
- **Array**: `array: true` input — gathers all selected meshes as one array
- **Ordered**: N mesh inputs, N selected — selection order maps to inputs (e.g. boolean: meshA=first, meshB=second)

`array: true` on an input OR an output has the same meaning: the value is a JS array of N items of `type`. Set it only when the handler actually returns (or accepts) a JS array — not just because a similar operator has it. For example, `tf.curvature` outputs `array: true` because `minMax` returns `[k0, k1]`; `tf.normals` does not because each variant returns a single ndarray.

### 2. Scene Operators (mutate visual state)

**Registry**: `sceneOperators` (SceneOperatorRegistry in `src/core/sceneOperatorRegistry.ts`)
**UI**: Drill-in with operands + controls but **no Run button** — changes apply live
**Execution**: `sceneOperator.apply(nodeId, args, scene)` called on every control change
**Result**: Node's `sceneOperatorState[soId]` updated → viewport rebuilds rendering

Example: `style.colorByArray` writes `{ array, colorMap, clip }` to the node's state. The viewport reads this and applies vertex colors.

Scene operators have three methods:
- `apply(nodeId, args, scene)` — write state to node
- `read(nodeId, scene)` — read current state
- `onOperandRemoved?(nodeId, removedId, scene)` — cleanup dangling references

### 3. Actions (direct manipulation)

**Registry**: `actionRegistry` (Map in `src/mcp/handler.ts`)
**UI**: Click in category list → executes immediately (no drill-in)
**Execution**: `action.execute(nodeIds, params)` — runs directly
**Result**: Scene/camera state modified

Actions are registered with `registerAction()` in handler.ts. They cover:
- **Scene**: select, delete, duplicate, set_color, translate, rotate, scale, screenshot, etc.
- **Camera**: fit_to_scene, fit_to_nodes, align_to_axis, describe
- **Inspect**: tf.analysis (full mesh report)

Actions with `usesNodeIds: true` require nodeIds. `usesNodeIds: 'optional'` falls back to current selection if none provided.

## Context Panel UI: Panels and Drill-ins

The left context panel (`src/components/ContextPanel.vue`) has three layers:

**Layer 1: Icon bar** — always visible. One icon per category. Clicking toggles the expanded panel.

**Layer 2: Expanded panel** — shows when a category is active or operands are present. Contains:
- **Operands section** (top): shows selected meshes, drag-to-reorder for ordered operators, child operand selectors
- **Category listing**: buttons for each operator/action in the active category
- **Drill-in content**: replaces category listing when an operator is selected

**Layer 3: Drill-in** — one of several types:
- `{ type: 'operator', operator }` — shows controls + Run button. For generators, enters live preview mode.
- `{ type: 'sceneOperator', sceneOperator }` — shows controls, no Run button. Changes apply live.
- `{ type: 'action', id: 'io-download' }` — download panel
- `{ type: 'report' }` — mesh analysis report view

The expanded panel width matches the title bar (set on the parent flex column). Content scrolls if needed.

## Operator Execution Path

UI and MCP share **one pipeline**. They differ only in how the initial `params` dict is assembled; everything downstream is identical.

```
UI:   gatherParamsFromUI(op, nodeIds)  ─┐
                                         ├──►  resolveInputs(op, nodeIds, params, scene)  ──►  executeOperator(op, inputs, ctx)
MCP:  request.params  ───────────────────┘                                                       │
                                                                                                 │ dispatcher.dispatch → op.async(inputs) → handleOutputs
```

**The canonical params dict** is what MCP sends natively; the UI gatherer builds the same shape:
- scalar input → `params[input.name] = value`
- childInput → `params[childInput.name] = operandId` (a string — viewport looks up the data)
- operand inputs themselves are NOT in params; they travel in `nodeIds` positionally

### The pieces

**`src/composables/operatorExecutor.ts`** — pure, no UI state, no MCP awareness:
- `resolveInputs(op, nodeIds, params, scene)` — schema walk, looks up operand data via nodeIds and childInput operandIds, returns the inputs dict `op.async` destructures. Returns `null` on missing non-optional input.
- `executeOperator(op, inputs, ctx)` — dispatches through `useDispatcher`, then `handleOutputs` creates scene nodes from the result.

**`src/composables/useActions.ts`** — UI-facing:
- `gatherParamsFromUI(op, nodeIds)` — reads `useUIState` for scalars (with `handler.combine` for composite inputs), `inputMapping.resolveChildId` for childInputs. Produces a params dict in the canonical shape.
- `runFromUI(opId, origin='user')` — handles batch / ordered / generator mode dispatch, calls `gatherParamsFromUI` + `resolveInputs` + `executeOperator`.
- `runFromMCP(opId, nodeIds, params)` — single-shot. Skips the gatherer (MCP already speaks the canonical shape), calls `resolveInputs` + `executeOperator`. Does NOT touch `useUIState`, does NOT mutate `scene.activeSelection`.
- `rebuildSync` / `rebuildAsync` — live generator preview. UI-only, uses `gatherParamsFromUI` + `resolveInputs` + direct `op.sync()`/`op.async()` (bypasses `executeOperator` because outputs are replaced in place, not created new).

### Key consequences

- **MCP runs don't pollute UI state**. Previously `state["tf.smooth.iterations"] = 5` persisted after MCP ran it. Now sliders keep user values.
- **childInput flows through**: MCP's `params.scalars = "distance-field-1"` hits the resolver directly. No more silent override by UI's auto-selected first child.
- **Adding a new operator input type or behavior** (e.g. a new kind of childInput) touches exactly one file: the resolver. Both callers get it.

## UI Input Handlers

Some operator inputs have one honest function signature but a human UX that calls for something richer. Example: `tf.isocontours` takes `cutValues: number[]` — the natural thing to pass from MCP. But humans want to drag `start` / `end` / `count` sliders, not type arrays.

**Registry**: `src/ui/inputHandlers.ts` — a `Map<(opId, inputName), UIInputHandler>` consulted only on the UI side. MCP never sees it. The operator schema stays honest.

```ts
interface UIInputHandler {
  inputs: (ctx: DeriveContext | null) => Input[]   // sub-inputs for the widget tree
  combine: (subValues: Record<string, unknown>) => unknown
}
```

- **`inputs(ctx)`** — a function so the sub-input schema (min/max/step/default) can depend on operand data. Called with `null` at app boot; with live context when a drill-in is open. Sub-input *names* must be stable across contexts (they key into `state`).
- **`combine(subValues)`** — reduces sub-values back to the real param value the operator receives. Called by `gatherParamsFromUI` right before `resolveInputs`.

Usage in `src/core/operators/fields.ts`:

```ts
registerUIInputHandler('tf.isocontours', 'cutValues', {
  inputs: (ctx) => {
    const stats = ctx?.properties[ctx.operandIds.scalars ?? '']
    const mn = (stats?.min as number | undefined) ?? 0
    const mx = (stats?.max as number | undefined) ?? 1
    return [
      { name: 'start', label: 'Start', type: 'number', min: mn, max: mx, default: mn },
      { name: 'end',   label: 'End',   type: 'number', min: mx, max: mn, default: mx },
      { name: 'count', label: 'Count', type: 'number', min: 1, max: 100, default: 1 },
    ]
  },
  combine: ({ start, end, count }) => linspace(start, end, count),
})
```

**Derived defaults** (`src/composables/useDerivedDefaults.ts`): `ContextPanel` watches for operand/child changes on handler-bearing drill-ins. On change, `applyDerivedDefaults` calls `handler.inputs(ctx)` with fresh context and reseeds sub-state from the returned `input.default` — unless the user has customized (strategy: if current state === last-derived value, reseed; else leave alone). This is how isocontours min/max sliders snap to the selected scalar array's bounds.

## Live Generator Preview

When a generator operator (no operand inputs) is drilled into:

1. The operator runs immediately, creating a preview mesh
2. Other nodes are dimmed
3. A `watch` monitors scalar param changes
4. On any change, `rebuildSync(opId, replaceMap)` re-runs `op.sync()` and replaces the preview mesh's data in-place (via `operands.replaceData()` → version bump → viewport rebuilds)
5. User clicks "Confirm" to keep, or navigates away to cancel (preview mesh removed)

For expensive operators, `rebuildAsync` coalesces rapid changes: at most 1 running + 1 pending rebuild.

## Execution & Task Dispatch

All operator execution goes through `useDispatcher`:

```
dispatcher.dispatch(label, source, asyncFn, origin?)
  → creates task { id, label, source, origin, status: 'running' }
  → runs asyncFn()
  → on success: status → 'done', auto-remove after 7s
  → on error: status → 'error', stays until dismissed
  → re-throws errors (caller can catch)
```

The TaskPanel (`src/components/TaskPanel.vue`) renders the task list:
- Running: teal spinner icon
- Done: teal check icon + duration badge
- Error: red X icon + error message + dismiss button
- Origin badge: bot icon for MCP, mouse icon for user

## Scene Architecture

`useScene()` in `src/scene/useScene.ts`:

**Data structures** (plain Maps, not reactive — zero Vue overhead):
- `nodes: Map<string, SceneNode>` — id, label, parentId, operandId, color, opacity, visible, renderMode, sceneOperatorState
- `children: Map<string | null, string[]>` — parent→child relationships (null = root)
- `properties: Record<operandId, ...>` — cached operand metrics. For meshes: `{ faces, vertices, aabb, obb }`. For ndarrays: `{ shape, dtype, min, max, mean, std }` (via `computeNDArrayStats` in `src/core/ndarrayStats.ts`, using trueform's parallelized WASM reductions).

**Reactive state:**
- `activeSelection: reactive<string[]>` — ordered list of selected node IDs
- `version: shallowRef` — bumped via `triggerRef` on any structural change
- `dirty: Set<string>` — node IDs needing viewport sync
- `tree: computed<MeshObject[]>` — builds the object list tree from nodes + children

**Key rule**: Scene mutations (setColor, setVisible, addNode, etc.) always call `dirty.add(nodeId)` + `bump()`. The viewport reads dirty + version to know what to rebuild.

**Property lifecycle**:
- `computeProperties(operandId)` — called from `addNode` on operand add; populates the cache with the right shape for the operand type (cheap sync pass; mesh obb dispatches async on top).
- `invalidateProperties(operandId)` — wired as a callback on `operands.replaceData`. When a generator's live-preview drag mutates operand data, cached properties are deleted (they describe the old data and would be stale). All readers guard against `undefined` properties — `ObjectList` shows `—`, `MCP world_state` omits the field, viewport/camera use operand geometry directly.
- `confirmPreview()` in `ContextPanel` calls `computeProperties` on each preview node after the drag ends, repopulating the cache from the final data. Same pattern as `restoreNodeState()` unmudding the dimmed nodes.

**Why MCP agents see live ndarray stats**: the stats land in `scene.properties` at `addNode` time and surface through `world_state` via the existing `sanitizeProperties()` path — no MCP-side plumbing. A bot querying a curvature child sees `min/max/mean/std` and can reason about sensible threshold values (e.g. for isocontours).

## Operand Registry

`operands` in `src/core/operands.ts`:

- Global singleton `OperandRegistry`
- Stores `{ id, type, data, version }` where data is a trueform object (tf.Mesh, tf.Curves, tf.NDArray)
- `nextId(prefix)` generates unique IDs: `sphere-1`, `boolean-2`, etc.
- `replaceData(id, newData)` bumps version — viewport detects mismatch and rebuilds
- `isOperandType(t)` type guard for narrowing strings to OperandType

Scene nodes reference operands by ID. Multiple nodes can share one operand (e.g. linked outputs).

## Viewport Sync

`useSceneSync` in `src/viewport/useSceneSync.ts`:

Each frame:
1. `scene.consumeDirty()` → get dirty node IDs, clear set
2. For each dirty node, `syncNode(id)`:
   - Node deleted? Dispose Three.js object
   - Operand version changed? Dispose + recreate geometry
   - Color source (`style.colorByArray`) or shading (`style.shading`) changed? Patch the `color`/`normal` attribute + material flags in place; fall back to rebuild if the transition can't be patched
   - Otherwise: update material properties (color, opacity, wireframe), visibility, transform
3. Update camera clip planes if scene bounds changed

**Geometry cache**: refcounted per operand. Multiple nodes sharing an operand share geometry. Version-tracked for automatic invalidation.

**Custom geometry attributes**: when `style.colorByArray` has an array OR `style.shading` is non-flat, the mesh needs its own `color`/`normal` attributes and can't share the cached geometry. `createMeshObject` sets `needsCustomGeometry` and builds fresh; `syncNode` tracks both `colorSourceKey` and `shadingKey` in `userData` and patches attrs in place when both the previous and next state use custom geometry, else rebuilds. Material flags (`vertexColors`, `flatShading`, solid color vs white) are kept in sync with the attributes — flipping either state without updating the material is a common bug source.

**Never** store Three.js objects in Vue reactive state. Use `shallowRef` or plain variables.

## MCP Handler

`src/mcp/handler.ts` — the brain of MCP integration.

**Dispatch chain:**
- `discover` → `handleDiscover()` — compact catalog or full operator detail
- `world_state` → `handleWorldState()` — scene contents (compact or detailed with OBB/AABB)
- `run` → `handleRun()` → `validateOperation()` + `executeSingle()` per operation

**executeSingle dispatch order:**
1. Check sceneOperators → `so.apply(target, params, scene)` — args pass through unchanged; apply interprets operandId strings itself.
2. Check actionRegistry → `action.execute(nodeIds, params)` — direct manipulation (select, translate, screenshot, etc.).
3. Check operators → `actions.runFromMCP(operatorId, nodeIds, params)` — the pure MCP execution path (see [Operator Execution Path](#operator-execution-path)). No UI state is written; no selection hijacking. Newly created nodes are detected by diffing the scene keyspace before/after and serialized into the response.

**Per-operation error handling**: if one operation in a batch fails, the error is captured and the next operation continues. Results array contains either success data or `{ error, operatorId }`.

**`HandlerContext` fields**: `scene`, `actions`, `dispatcher`, `getViewport`, `importFromUrl`, `onProgress?`. No `state` — MCP doesn't touch `useUIState` anymore.

**Tool schema generation** (`src/mcp/toolSchemas.ts`): reads all three registries to build the `operatorId` enum for the `run` tool. Called once on MCP connection (`__list_tools`).

## Cloudflare Deployment

**Worker** (`functions/worker.ts`):
- `/mcp/{sessionId}/*` → route to Durable Object
- Everything else → serve static SPA from `dist/` with COOP/COEP headers (required for WASM SharedArrayBuffer)

**Durable Object** (`functions/mcp-session.ts`):
- Holds browser WebSocket + pending request map
- MCP clients POST JSON-RPC → DO forwards to browser WS → awaits response → returns
- `initialize` returns server instructions + session ID
- `tools/list` returns static tool schemas
- `tools/call` relays to browser, formats results (extracts images)
- GET with `Accept: text/event-stream` → 405 (prevents mcp-remote polling)
- LLM stringify workaround: parses JSON string args before forwarding

**Session**: 8-char UUID stored in localStorage. `luna-mcp-enabled` flag controls auto-connect.

## CSS & Theming

- `src/assets/theme.css`: all `--ln-*` custom properties (colors, spacing, panel chrome)
- `src/assets/main.css`: `@theme` block registers `--spacing-inset` and `--spacing-panel-gap` as Tailwind utilities
- `vite.config.ts`: Nuxt UI component theming (toast, modal, popover, tree, etc.)
- Brand color: teal `#00d5be` — used for selection, accent, active states

## State Management

No Pinia/Vuex. Explicit reactive patterns:

| Store | Location | Type | Persistence | Notes |
|---|---|---|---|---|
| Scene nodes | `useScene()` | Plain Maps + dirty Set | None (runtime only) | |
| Operands | `operands` singleton | Map with versions | None | PointCloud cache for align; invalidates scene properties on replaceData |
| UI params | `useUIState()` | `reactive<Record<string, unknown>>` | None | **UI-only**. MCP does NOT write here. Keys: `${op.id}.${input.name}` and `${op.id}.${input.name}.${sub.name}` for handler sub-inputs. |
| Child selections | `useInputMapping()` | `reactive<Record<nodeId, operandId>>` | None | UI-only. `resolveChildId()` returns the operandId string for the gatherer. |
| Derived defaults | `useDerivedDefaults` (module-local) | `reactive` sidecar dict | None | Tracks last auto-seeded sub-input values for untouched-check. |
| Preferences | `usePreferences()` | `reactive` singleton | localStorage (debounced) | |
| Tasks | `useDispatcher()` | `reactive` array | None | |
| MCP session | `useMCP()` | refs | localStorage (session ID + enabled flag) | |

Provide/inject from App.vue: `runAction`, `rebuildSync`, `dispatcher`, `interactionMode`, `stickyInteractionMode`, `lockedAxis`, `viewportCamera`, `setAxisLock`, `rotateSelection90`, `alignCameraToAxis`, `snapCameraToAxis`.

## Package Manager

Use `pnpm`, not npm.

## Commands

```bash
pnpm dev              # Vite dev server (port 5173)
pnpm dev:mcp          # Build + wrangler dev (port 8788) — full MCP stack
pnpm build            # Type-check + build
pnpm build-only       # Build without type-check
pnpm deploy           # Build + wrangler deploy to Cloudflare
```

## Patterns to Follow

- `<script setup lang="ts">` for all components
- `defineProps<T>()` with interface generics
- `shallowRef()` for Three.js objects and large data
- Comments explain WHY, not WHAT
- Section dividers only in files over 300 lines
- Operators define both `sync` and `async`
- Scene mutations always: `dirty.add(nodeId)` + `bump()`
- No Pinia — use existing reactive patterns
- `pnpm`, never npm
