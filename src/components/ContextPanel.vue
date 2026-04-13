<script setup lang="ts">
import { ref, computed, provide, watchEffect, watch } from 'vue'
import type { useScene } from '@/scene/useScene'
import type { useInputMapping } from '@/composables/useInputMapping'
import type { Category, CategoryItem } from '@/setup/categories'
import type { Operator, SceneOperator } from '@/core'
import { operands } from '@/core'
import { operatorInputsToUI } from '@/setup/operatorToUI'
import { getOperationMode, type OperationMode } from '@/core/operationMode'
import { formatCount } from '@/utils/format'
import { createSceneOperatorStateBag, STATE_BAG_KEY, type StateBag } from '@/composables/stateBag'
import { useUIState } from '@/composables/useUIState'
import { OPERAND_TYPES } from '@/core/operands'
import { generateReport, getCachedReport, type OperandReport } from '@/composables/useReport'
import { applyDerivedDefaults, buildContext } from '@/composables/useDerivedDefaults'
import { listUIInputHandlers } from '@/ui/inputHandlers'
import type { useDispatcher } from '@/composables/useDispatcher'
type Scene = ReturnType<typeof useScene>
type InputMapping = ReturnType<typeof useInputMapping>

export type DrillIn =
  | { type: 'operator'; operator: Operator }
  | { type: 'sceneOperator'; sceneOperator: SceneOperator }
  | { type: 'action'; id: string }
  | { type: 'report' }

const props = defineProps<{
  scene: Scene
  categories: Category[]
  inputMapping: InputMapping
}>()

const emit = defineEmits<{
  download: [name: string, url: string]
}>()

const runAction = inject<(id: string) => void>('runAction')

const activeCategory = defineModel<string | null>('category', { default: null })
const activeDrillIn = defineModel<DrillIn | null>('drillIn', { default: null })

// ── Derived state from drill-in ──────────────────────────

const activeOperator = computed<Operator | null>(() =>
  activeDrillIn.value?.type === 'operator' ? activeDrillIn.value.operator : null,
)

const activeSceneOperator = computed<SceneOperator | null>(() =>
  activeDrillIn.value?.type === 'sceneOperator' ? activeDrillIn.value.sceneOperator : null,
)

const activeAction = computed<string | null>(() => (activeDrillIn.value?.type === 'action' ? activeDrillIn.value.id : null))

/** Whichever operator-like thing is active (for operands, mode, controls). */
const activeThing = computed<Operator | SceneOperator | null>(
  () => activeOperator.value ?? activeSceneOperator.value ?? null,
)

// ── Live generator preview ───────────────────────────────

const rebuildSync = inject<(opId: string, replaceMap: Record<string, string>) => void>('rebuildSync')
const uiState = useUIState()

const isGeneratorPreview = computed(() => {
  if (!activeOperator.value) return false
  return getOperationMode(activeOperator.value, 0).kind === 'generator'
})

const liveReplaceMap = ref<Record<string, string> | null>(null)
const liveOpId = ref<string | null>(null)

// Snapshot of other nodes' state before preview, for restore
let savedNodeState: Map<string, { opacity: number; pickable?: boolean }> | null = null

function dimOtherNodes(focusIds: Set<string>) {
  savedNodeState = new Map()
  for (const [id, node] of props.scene.nodes) {
    if (focusIds.has(id)) continue
    savedNodeState.set(id, { opacity: node.opacity, pickable: node.pickable })
    props.scene.setOpacity(id, 20)
    node.pickable = false
    props.scene.dirty.add(id)
  }
}

function restoreNodeState() {
  if (!savedNodeState) return
  for (const [id, state] of savedNodeState) {
    const node = props.scene.getNode(id)
    if (!node) continue
    props.scene.setOpacity(id, state.opacity)
    node.pickable = state.pickable
    props.scene.dirty.add(id)
  }
  savedNodeState = null
}

// When a generator drill-in opens, create the mesh and start live tracking
watch(activeDrillIn, async (drillIn, old) => {
  // Leaving a live preview without confirming → cancel
  if (liveReplaceMap.value && drillIn !== old) {
    restoreNodeState()
    for (const nodeId of Object.values(liveReplaceMap.value)) {
      props.scene.removeNode(nodeId)
    }
    liveReplaceMap.value = null
    liveOpId.value = null
  }

  if (!drillIn || drillIn.type !== 'operator') return
  const op = drillIn.operator
  if (getOperationMode(op, 0).kind !== 'generator') return

  const beforeIds = new Set(props.scene.nodes.keys())
  runAction?.(`${op.id}.run`)

  // Wait for async dispatch to complete
  await new Promise((r) => setTimeout(r, 150))

  // Build replaceMap from newly created nodes
  const map: Record<string, string> = {}
  for (const output of op.outputs) {
    for (const [id] of props.scene.nodes) {
      if (beforeIds.has(id)) continue
      if (!map[output.name]) {
        map[output.name] = id
        break
      }
    }
  }

  liveReplaceMap.value = map
  liveOpId.value = op.id

  // Dim everything except the new preview nodes
  dimOtherNodes(new Set(Object.values(map)))
})

// Watch scalar params → rebuild on change
watch(
  () => {
    if (!liveOpId.value || !liveReplaceMap.value || !activeOperator.value) return null
    const op = activeOperator.value
    return op.inputs
      .filter((i) => !(OPERAND_TYPES as readonly string[]).includes(i.type))
      .map((i) => uiState[`${op.id}.${i.name}`])
      .join(',')
  },
  () => {
    if (liveOpId.value && liveReplaceMap.value) {
      rebuildSync?.(liveOpId.value, liveReplaceMap.value)
    }
  },
)

function confirmPreview() {
  // Repopulate cached properties for the final state. During the drag,
  // operands.replaceData invalidated them so nothing rendered stale values;
  // now that the user has committed, aabb/obb/stats should reflect the data
  // they settled on. Mirrors how restoreNodeState() un-dims the other nodes.
  if (liveReplaceMap.value) {
    for (const nodeId of Object.values(liveReplaceMap.value)) {
      const node = props.scene.getNode(nodeId)
      if (node?.operandId) props.scene.computeProperties(node.operandId)
    }
  }
  restoreNodeState()
  liveReplaceMap.value = null
  liveOpId.value = null
  activeDrillIn.value = null
}

function cancelPreview() {
  restoreNodeState()
  if (liveReplaceMap.value) {
    for (const nodeId of Object.values(liveReplaceMap.value)) {
      props.scene.removeNode(nodeId)
    }
  }
  liveReplaceMap.value = null
  liveOpId.value = null
  activeDrillIn.value = null
}

// ── Escape / navigation ──────────────────────────────────

function handleEscape(): boolean {
  if (liveReplaceMap.value) {
    cancelPreview()
    return true
  }
  if (activeDrillIn.value) {
    activeDrillIn.value = null
    return true
  }
  if (activeCategory.value) {
    activeCategory.value = null
    return true
  }
  return false
}

function openOperator(op: Operator) {
  const cat = props.categories.find((c) => c.items.some((i) => i.type === 'operator' && i.operator.id === op.id))
  if (cat) activeCategory.value = cat.id
  activeDrillIn.value = { type: 'operator', operator: op }
}

defineExpose({ handleEscape, openOperator })

// ── State bag for scene operator controls ──────────────

const stateBag = ref<StateBag | null>(null)
watchEffect(() => {
  stateBag.value = activeSceneOperator.value ? createSceneOperatorStateBag(activeSceneOperator.value, props.scene) : null
})
provide(STATE_BAG_KEY, stateBag)

// ── Category state ──────────────────────────────────────

function toggleCategory(catId: string) {
  if (activeCategory.value === catId) {
    activeCategory.value = null
    activeDrillIn.value = null
  } else {
    activeCategory.value = catId
    activeDrillIn.value = null
  }
}

// ── Report ──────────────────────────────────────────────
const reportData = ref<OperandReport[]>([])
const reportLoading = ref(false)
const dispatcher = inject<ReturnType<typeof useDispatcher>>('dispatcher')

// Re-run report when selection changes while report is open
watch(
  () => [...props.scene.activeSelection].join(','),
  () => {
    if (activeDrillIn.value?.type === 'report') {
      runReport()
    }
  },
)

async function runReport() {
  activeDrillIn.value = { type: 'report' }
  const nodeIds = [...props.scene.activeSelection]

  // Check if all reports are cached
  const cached = nodeIds.map(getCachedReport).filter((r): r is OperandReport => r !== null)
  if (cached.length === nodeIds.length) {
    reportData.value = cached
    reportLoading.value = false
    return
  }

  reportLoading.value = true
  reportData.value = []

  const promises = nodeIds.map(async (id) => {
    const label = props.scene.getNode(id)?.label
    const compute = async () => {
      const report = await generateReport(id, props.scene)
      reportData.value = [...reportData.value, report]
      return report
    }
    try {
      if (dispatcher) {
        await dispatcher.dispatch('Analysis', label, compute)
      } else {
        await compute()
      }
    } catch (e) {
      console.error(`Report failed for ${id}:`, e)
    }
  })
  await Promise.all(promises)
  reportLoading.value = false
}

function reportToMarkdown(reports: OperandReport[]): string {
  return reports
    .map((r) => {
      const lines: string[] = []
      const title = reports.length > 1 ? `# ${r.label}` : `# Analysis: ${r.label}`
      lines.push(title, '')

      if (r.kind === 'mesh') {
        lines.push('## Quality', '')
        lines.push(
          r.issues.length === 0
            ? '**No issues found**'
            : `**${r.issues.length} issue${r.issues.length > 1 ? 's' : ''} found**`,
        )
        lines.push('')
        lines.push(
          `- Closed: ${r.isClosed ? '✓' : '✗'}${r.boundaryEdgeCount > 0 ? ` (${r.boundaryEdgeCount} boundary edges)` : ''}`,
        )
        lines.push(
          `- Manifold: ${r.isManifold ? '✓' : '✗'}${r.nonManifoldEdgeCount > 0 ? ` (${r.nonManifoldEdgeCount} non-manifold edges)` : ''}`,
        )
        lines.push(`- No self-intersections: ${r.hasSelfIntersections ? '✗' : '✓'}`)
        lines.push('')

        lines.push('## Overview', '')
        lines.push(`- Faces: ${r.faces.toLocaleString()}`)
        lines.push(`- Vertices: ${r.vertices.toLocaleString()}`)
        lines.push(`- Components: ${r.connectedComponents}`)
        if (r.obbExtent) lines.push(`- Dimensions: ${r.obbExtent[0]} × ${r.obbExtent[1]} × ${r.obbExtent[2]}`)
        lines.push('')

        lines.push('## Measurements', '')
        lines.push(`- Surface area: ${r.area}`)
        lines.push(`- Volume: ${r.volume}`)
        lines.push('')

        if (r.curvatureStats) {
          lines.push('## Curvature (mean)', '')
          lines.push(`- Min: ${r.curvatureStats.min}`)
          lines.push(`- Max: ${r.curvatureStats.max}`)
          lines.push(`- Mean: ${r.curvatureStats.mean}`)
          lines.push(`- Std: ${r.curvatureStats.std}`)
          lines.push('')
        }
      } else if (r.kind === 'curves') {
        lines.push('## Overview', '')
        lines.push(`- Paths: ${r.paths.toLocaleString()}`)
        lines.push(`- Segments: ${r.segments.toLocaleString()}`)
        lines.push(`- Vertex refs: ${r.vertexRefs.toLocaleString()}`)
        if (r.aabbExtent) lines.push(`- Dimensions: ${r.aabbExtent[0]} × ${r.aabbExtent[1]} × ${r.aabbExtent[2]}`)
        lines.push('')

        lines.push('## Measurements', '')
        lines.push(`- Total length: ${r.totalLength}`)
        lines.push('')
      } else if (r.kind === 'ndarray') {
        lines.push('## Overview', '')
        lines.push(`- Shape: [${r.shape.join(', ')}]`)
        lines.push(`- Dtype: ${r.dtype}`)
        lines.push(`- Length: ${r.length.toLocaleString()}`)
        lines.push('')

        lines.push('## Stats', '')
        lines.push(`- Min: ${r.stats.min}`)
        lines.push(`- Max: ${r.stats.max}`)
        lines.push(`- Mean: ${r.stats.mean}`)
        lines.push(`- Std: ${r.stats.std}`)
        lines.push('')

        if (r.components && r.components.length > 0) {
          lines.push('## Components', '')
          lines.push('| | Min | Max | Mean | Std |')
          lines.push('|---|---:|---:|---:|---:|')
          const labels = ['X', 'Y', 'Z', 'W']
          r.components.forEach((c, i) => {
            lines.push(`| ${labels[i] ?? i} | ${c.min} | ${c.max} | ${c.mean} | ${c.std} |`)
          })
          lines.push('')
        }

        if (r.histogram) {
          lines.push('## Distribution', '')
          lines.push(`Range: [${r.histogram.min}, ${r.histogram.max}] — ${r.histogram.bins.length} bins`)
          if (r.histogram.nanCount > 0) {
            lines.push(`NaN values filtered: ${r.histogram.nanCount.toLocaleString()}`)
          }
          lines.push('')
          lines.push('```')
          lines.push(`[${r.histogram.bins.join(', ')}]`)
          lines.push('```')
          lines.push('')
        }
      }

      return lines.join('\n')
    })
    .join('\n---\n\n')
}

async function copyReportMarkdown() {
  await navigator.clipboard.writeText(reportToMarkdown(reportData.value))
}

function downloadReportMarkdown() {
  const md = reportToMarkdown(reportData.value)
  const name = reportData.value.length === 1 ? reportData.value[0]!.label : 'analysis'
  const blob = new Blob([md], { type: 'text/markdown' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `${name.toLowerCase().replace(/\s+/g, '-')}-analysis.md`
  a.click()
  URL.revokeObjectURL(url)
}

function handleItemClick(item: CategoryItem) {
  if (item.type === 'action') {
    if (item.id === 'io-download') {
      activeDrillIn.value = { type: 'action', id: 'io-download' }
      return
    }
    if (item.id === 'tf.analysis') {
      runReport()
      return
    }
    runAction?.(item.id)
  } else if (item.type === 'operator') {
    activeDrillIn.value =
      activeOperator.value?.id === item.operator.id ? null : { type: 'operator', operator: item.operator }
  } else if (item.type === 'sceneOperator') {
    activeDrillIn.value =
      activeSceneOperator.value?.id === item.sceneOperator.id
        ? null
        : { type: 'sceneOperator', sceneOperator: item.sceneOperator }
  }
}

const activeCategoryData = computed(() => {
  if (!activeCategory.value) return null
  return props.categories.find((c) => c.id === activeCategory.value) ?? null
})

const operatorControls = computed(() => {
  if (!activeOperator.value) return null
  // Depend on entries so slider bounds re-derive when operand/child changes.
  void entries.value
  const ctx = buildContext(activeOperator.value, props.scene, props.inputMapping)
  return operatorInputsToUI(activeOperator.value, ctx)
})

const sceneOperatorControls = computed(() => {
  if (!activeSceneOperator.value) return null
  void entries.value
  const ctx = buildContext(activeSceneOperator.value, props.scene, props.inputMapping)
  return operatorInputsToUI(activeSceneOperator.value, ctx)
})

// ── Operands section ────────────────────────────────────

const entries = computed(() => props.inputMapping.buildEntries(activeThing.value))

// Seed sub-input defaults when a handler-bearing drill-in is active and its
// operand context changes. The source returns null when no relevant op is
// open, so the watcher never fires for unrelated selection changes.
watch(
  () => {
    const op = activeThing.value
    if (!op || !listUIInputHandlers(op.id)) return null
    const sig = entries.value.map((e) => `${e.nodeId}:${e.selectedChild ?? ''}`).join('|')
    return { op, sig }
  },
  (curr) => {
    if (curr?.op) applyDerivedDefaults(curr.op, props.scene, props.inputMapping)
  },
  { immediate: true },
)

/**
 * Type-dispatched one-line summary for the operand row. Reads from the
 * cached scene properties — returns `null` when properties are missing
 * (mid-preview slider drag: `operands.replaceData` invalidated them), and
 * the template shows "—" in that case. Counts only appear for present,
 * non-zero values.
 *
 *   mesh     → "N tris"        (from properties.faces)
 *   curves   → "N paths"       (from properties.paths)
 *   ndarray  → "[shape]"       (from properties.shape)
 */
function getOperandBadge(nodeId: string): string | null {
  const node = props.scene.getNode(nodeId)
  if (!node?.operandId) return null
  const operand = operands.get(node.operandId)
  const p = props.scene.getProperties(node.operandId)
  if (!operand || !p) return null
  switch (operand.type) {
    case 'mesh': {
      const faces = p.faces
      return typeof faces === 'number' && faces > 0 ? `${formatCount(faces)} tris` : null
    }
    case 'curves': {
      const paths = p.paths
      return typeof paths === 'number' && paths > 0 ? `${formatCount(paths)} paths` : null
    }
    case 'ndarray': {
      const shape = p.shape
      if (!Array.isArray(shape) || shape.length === 0) return null
      // Format each dim through formatCount so a [240428, 3] normals array
      // renders as "[240k×3]" rather than dumping the raw integers.
      return `[${(shape as number[]).map(formatCount).join('×')}]`
    }
    case 'pointcloud':
      return null
  }
}

// Face count for the header "N tris" summary. Only meshes contribute —
// curves/ndarrays carry different units and aren't summed into a single
// total. Other operand types just don't participate.
function getFaceCount(nodeId: string): number | null {
  const node = props.scene.getNode(nodeId)
  if (!node?.operandId) return null
  const faces = props.scene.getProperties(node.operandId)?.faces
  return typeof faces === 'number' ? faces : null
}

const totalFaces = computed(() => entries.value.reduce((sum, e) => sum + (getFaceCount(e.nodeId) ?? 0), 0))

const mode = computed<OperationMode | null>(() => {
  if (!activeThing.value) return null
  return getOperationMode(activeThing.value, props.scene.activeSelection.length)
})

const orderedSlots = computed(() => {
  if (!activeThing.value || mode.value?.kind !== 'ordered') return null
  return mode.value.inputs
})

const missingSlots = computed(() => {
  if (!activeThing.value || mode.value?.kind !== 'insufficient') return null
  const operandInputs = activeThing.value.inputs.filter((i) => ['mesh', 'pointcloud', 'curves'].includes(i.type))
  const arrayInput = operandInputs.find((i) => i.array)
  if (arrayInput) {
    const deficit = mode.value.needed - mode.value.have
    return Array.from({ length: deficit }, () => arrayInput)
  }
  return operandInputs.slice(entries.value.length)
})

const isDraggable = computed(() => !mode.value || mode.value.kind === 'ordered')

function inputLabel(i: number): string {
  if (orderedSlots.value && orderedSlots.value[i]) return orderedSlots.value[i].label
  return `${i + 1}`
}

function modeLabel(): string {
  if (!mode.value) return ''
  switch (mode.value.kind) {
    case 'batch':
      return 'Batch'
    case 'array':
      return 'Array'
    default:
      return ''
  }
}

const isRunnable = computed(() => {
  if (!activeOperator.value || !mode.value) return true
  if (mode.value.kind === 'insufficient') return false
  if (mode.value.kind === 'generator') return true
  for (const entry of entries.value) {
    if (entry.childInput && entry.matchingChildren.length === 0) return false
  }
  return true
})

// ── Inline child selector ────────────────────────────────

const CHILD_NONE = '__none__'

function childItems(entry: {
  childInput?: { optional?: boolean }
  matchingChildren: { operandId: string; label: string }[]
}) {
  const items = entry.matchingChildren.map((c) => ({ label: c.label, value: c.operandId }))
  const includeNone = !!activeSceneOperator.value || entry.childInput?.optional === true
  if (includeNone) return [{ label: 'None', value: CHILD_NONE }, ...items]
  return items
}

function getChildValue(entry: { nodeId: string; childInput?: { name: string }; selectedChild: string | null }): string {
  // eslint-disable-next-line @typescript-eslint/no-unused-expressions
  props.scene.version.value
  if (activeSceneOperator.value && entry.childInput) {
    const values = activeSceneOperator.value.read(entry.nodeId, props.scene)
    const v = values[entry.childInput.name]
    return (v as string | null | undefined) ?? CHILD_NONE
  }
  return entry.selectedChild ?? CHILD_NONE
}

function setChildValue(entry: { nodeId: string; childInput?: { name: string } }, value: string) {
  const operandId = value === CHILD_NONE ? null : value
  if (activeSceneOperator.value && entry.childInput) {
    const current = activeSceneOperator.value.read(entry.nodeId, props.scene)
    activeSceneOperator.value.apply(entry.nodeId, { ...current, [entry.childInput.name]: operandId }, props.scene)
  } else if (operandId !== null) {
    props.inputMapping.selectChild(entry.nodeId, operandId)
  }
}

// ── Drag reorder ────────────────────────────────────────

let dragIdx: number | null = null

function onDragStart(e: DragEvent, i: number) {
  dragIdx = i
  if (e.dataTransfer) e.dataTransfer.effectAllowed = 'move'
}

function onDragOver(e: DragEvent) {
  e.preventDefault()
  if (e.dataTransfer) e.dataTransfer.dropEffect = 'move'
}

function onDrop(e: DragEvent, i: number) {
  e.preventDefault()
  if (dragIdx === null || dragIdx === i) return
  const selection = [...props.scene.activeSelection]
  const [moved] = selection.splice(dragIdx, 1)
  selection.splice(i, 0, moved!)
  props.scene.clearSelection()
  for (const id of selection) {
    props.scene.select(id, true)
  }
  dragIdx = null
}

function onDragEnd() {
  dragIdx = null
}

function onHover(nodeId: string | null) {
  props.scene.hoveredNode.value = nodeId
}

const showExpandedPanel = computed(() => {
  return entries.value.length > 0 || activeCategoryData.value !== null || activeDrillIn.value !== null
})
</script>

<template>
  <div class="flex flex-row gap-2 items-start pointer-events-none min-w-0 w-full">
    <!-- Icon bar -->
    <WidgetMenu class="pointer-events-auto shrink-0">
      <nav class="flex flex-col gap-1">
        <UTooltip v-for="cat in categories" :key="cat.id" :text="cat.label" :delay-duration="300">
          <UButton
            :icon="cat.icon"
            :variant="activeCategory === cat.id ? 'solid' : 'ghost'"
            :color="activeCategory === cat.id ? 'primary' : 'neutral'"
            size="lg"
            @click="toggleCategory(cat.id)"
          />
        </UTooltip>
      </nav>
    </WidgetMenu>

    <!-- Unified expanded panel -->
    <Transition name="panel-left">
      <WidgetMenu v-if="showExpandedPanel" class="flex-1 min-w-0 pointer-events-auto">
        <div class="flex flex-col gap-1 p-1">
          <!-- Operands section (always visible when panel is open) -->
          <div class="flex flex-row items-center justify-between px-2 py-1 gap-2">
            <div class="flex items-center gap-1.5">
              <h3 class="uppercase text-xs font-bold text-default/60">Operands</h3>
              <span
                v-if="totalFaces > 0"
                class="text-[10px] uppercase font-bold font-mono px-1.5 py-0.5 rounded bg-[var(--ln-muted)] text-default/70"
              >
                {{ formatCount(totalFaces) }} tris
              </span>
            </div>
            <span
              v-if="modeLabel()"
              class="text-[10px] uppercase font-bold px-1.5 py-0.5 rounded bg-[var(--ln-active)] text-[var(--ln-accent)]"
            >
              {{ modeLabel() }}
            </span>
          </div>
          <div class="flex flex-col gap-0.5 min-h-8 max-h-48 overflow-y-auto">
            <!-- Filled operand rows -->
            <div v-for="(entry, i) in entries" :key="entry.nodeId">
              <div
                :draggable="isDraggable"
                class="flex items-center gap-2 px-2 py-1 rounded-md hover:bg-[var(--ln-hover)] transition-colors text-sm min-w-0"
                :class="isDraggable ? 'cursor-grab active:cursor-grabbing' : ''"
                @dragstart="onDragStart($event, i)"
                @dragover="onDragOver"
                @drop="onDrop($event, i)"
                @dragend="onDragEnd"
                @pointerenter="onHover(entry.nodeId)"
                @pointerleave="onHover(null)"
              >
                <UIcon v-if="isDraggable" name="i-lucide:grip-vertical" class="size-3.5 text-default/30 shrink-0" />
                <span class="truncate flex-1">{{ entry.label }}</span>
                <span class="text-default/40 text-[10px] font-mono shrink-0">
                  {{ getOperandBadge(entry.nodeId) ?? '—' }}
                </span>
                <span class="text-default/60 text-xs font-mono shrink-0">{{ inputLabel(i) }}</span>
              </div>

              <!-- Child operand selector -->
              <div v-if="entry.childInput && entry.matchingChildren.length > 0" class="pl-6 pr-2 py-0.5">
                <USelect
                  :model-value="getChildValue(entry)"
                  :items="childItems(entry)"
                  size="xs"
                  class="w-full"
                  @update:model-value="setChildValue(entry, $event)"
                />
              </div>
              <div
                v-else-if="entry.childInput && entry.matchingChildren.length === 0"
                class="flex items-center gap-2 pl-6 pr-2 py-0.5 text-default/30 text-xs italic"
              >
                <UIcon name="i-lucide:circle-dashed" class="size-3 shrink-0" />
                <span>No {{ entry.childInput.label?.toLowerCase() ?? 'data' }} available</span>
              </div>
            </div>

            <!-- Missing operand placeholder rows -->
            <div
              v-for="(slot, i) in missingSlots"
              :key="`missing-${i}`"
              class="flex items-center gap-2 px-2 py-1 rounded-md text-sm min-w-0 text-default/30"
            >
              <UIcon name="i-lucide:plus-circle" class="size-3.5 shrink-0" />
              <span class="flex-1 truncate italic">Select {{ slot.type }}</span>
              <span class="text-xs font-mono shrink-0">{{ slot.label }}</span>
            </div>

            <!-- Empty state -->
            <div v-if="entries.length === 0 && !missingSlots" class="px-2 py-1 text-sm text-default/40 italic">
              No selection
            </div>
          </div>

          <!-- Divider before category content -->
          <Separator v-if="activeCategoryData" />

          <!-- Category listing: items as buttons -->
          <template v-if="activeCategoryData && !activeDrillIn">
            <h3 class="uppercase text-xs font-bold px-2 py-1 text-default/60">{{ activeCategoryData.label }}</h3>
            <UButton
              v-for="item in activeCategoryData.items"
              :key="item.type === 'action' ? item.id : item.type === 'operator' ? item.operator.id : item.sceneOperator.id"
              :label="
                item.type === 'action'
                  ? item.label
                  : item.type === 'operator'
                    ? item.operator.label
                    : item.sceneOperator.label
              "
              variant="ghost"
              color="neutral"
              class="justify-start"
              @click="handleItemClick(item)"
            />
          </template>

          <!-- Operator drill-in -->
          <template v-if="activeOperator">
            <div class="flex flex-row items-center gap-2 px-2 py-1">
              <UButton
                icon="i-lucide:arrow-left"
                variant="ghost"
                color="neutral"
                size="xs"
                @click="isGeneratorPreview ? cancelPreview() : (activeDrillIn = null)"
              />
              <h3 class="uppercase text-xs font-bold text-[var(--ln-accent)]">{{ activeOperator.label }}</h3>
              <a
                v-if="activeOperator.docsUrl"
                :href="activeOperator.docsUrl"
                target="_blank"
                rel="noopener"
                class="text-[var(--ln-accent)] opacity-60 hover:opacity-100 transition-opacity ml-auto"
                title="View docs"
              >
                <UIcon name="i-lucide:book-open" class="size-4" />
              </a>
            </div>
            <div class="flex flex-col gap-1.5 px-1">
              <DynamicComponent v-for="(control, index) in operatorControls" :key="index" :action="control" />
              <div v-if="isGeneratorPreview" class="flex gap-2 mt-2">
                <UButton label="Cancel" icon="i-lucide:x" variant="ghost" color="neutral" @click="cancelPreview" />
                <UButton
                  label="Confirm"
                  icon="i-lucide:check"
                  color="primary"
                  variant="solid"
                  block
                  @click="confirmPreview"
                />
              </div>
              <UButton
                v-else
                :label="activeOperator.label"
                icon="i-lucide:play"
                color="primary"
                variant="solid"
                block
                class="mt-2"
                :disabled="!isRunnable"
                @click="runAction?.(`${activeOperator.id}.run`)"
              />
            </div>
          </template>

          <!-- SceneOperator drill-in (live, no Run button) -->
          <template v-if="activeSceneOperator">
            <div class="flex flex-row items-center gap-2 px-2 py-1">
              <UButton icon="i-lucide:arrow-left" variant="ghost" color="neutral" size="xs" @click="activeDrillIn = null" />
              <h3 class="uppercase text-xs font-bold text-[var(--ln-accent)]">{{ activeSceneOperator.label }}</h3>
              <a
                v-if="activeSceneOperator.docsUrl"
                :href="activeSceneOperator.docsUrl"
                target="_blank"
                rel="noopener"
                class="text-[var(--ln-accent)] opacity-60 hover:opacity-100 transition-opacity ml-auto"
                title="View docs"
              >
                <UIcon name="i-lucide:book-open" class="size-4" />
              </a>
            </div>
            <div class="flex flex-col gap-1.5 px-1">
              <DynamicComponent v-for="(control, index) in sceneOperatorControls" :key="index" :action="control" />
            </div>
          </template>

          <!-- Download drill-in -->
          <template v-if="activeAction === 'io-download'">
            <div class="flex flex-row items-center gap-2 px-2 py-1">
              <UButton icon="i-lucide:arrow-left" variant="ghost" color="neutral" size="xs" @click="activeDrillIn = null" />
              <h3 class="uppercase text-xs font-bold text-[var(--ln-accent)]">Download</h3>
            </div>
            <DownloadPanel
              @select="
                (name: string, url: string) => {
                  emit('download', name, url)
                  activeDrillIn = null
                }
              "
            />
          </template>

          <!-- Report drill-in -->
          <template v-if="activeDrillIn?.type === 'report'">
            <div class="flex flex-row items-center gap-2 px-2 py-1">
              <UButton icon="i-lucide:arrow-left" variant="ghost" color="neutral" size="xs" @click="activeDrillIn = null" />
              <h3 class="uppercase text-xs font-bold text-[var(--ln-accent)] flex-1">Analysis</h3>
              <UButton
                v-if="reportData.length > 0"
                icon="i-lucide:copy"
                variant="ghost"
                color="neutral"
                size="xs"
                title="Copy as markdown"
                @click="copyReportMarkdown"
              />
              <UButton
                v-if="reportData.length > 0"
                icon="i-lucide:download"
                variant="ghost"
                color="neutral"
                size="xs"
                title="Download .md"
                @click="downloadReportMarkdown"
              />
            </div>
            <div v-if="reportLoading" class="flex items-center gap-2 px-2 py-4">
              <UIcon name="i-lucide:loader-circle" class="size-4 text-[var(--ln-accent)] animate-spin" />
              <span class="text-xs text-default/50">Analyzing mesh...</span>
            </div>
            <ReportView v-else-if="reportData.length > 0" :reports="reportData" />
            <div v-else class="px-2 py-4 text-xs text-default/40 italic">No mesh selected</div>
          </template>
        </div>
      </WidgetMenu>
    </Transition>
  </div>
</template>
