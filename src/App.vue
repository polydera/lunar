<script setup lang="ts">
import { operands, operators, setPropertiesInvalidator } from '@/core'
import { useScene } from '@/scene/useScene'
import { useViewport } from '@/viewport/useViewport'
import { useActions } from '@/composables/useActions'
import { useUIState } from '@/composables/useUIState'
import { buildCategories } from '@/setup/categories'
import { useInputMapping } from '@/composables/useInputMapping'
import { useDispatcher } from '@/composables/useDispatcher'
import { prefs } from '@/composables/usePreferences'
import { useMCP } from '@/mcp/useMCP'
import { getUIInputHandler } from '@/ui/inputHandlers'
import { useFileIO } from '@/composables/useFileIO'
import { useShowcase } from '@/composables/useShowcase'
import { useBreakpoint } from '@/composables/useBreakpoint'
import { trackOperation } from '@/analytics/umami'
import AppHeader from '@/components/layout/AppHeader.vue'
import SelectionBar from '@/components/layout/SelectionBar.vue'
import MobilePanelLauncher, { type MobilePanelKind } from '@/components/MobilePanelLauncher.vue'

import type { DrillIn } from '@/components/ContextPanel.vue'

// ── Core setup ──────────────────────────────────────────

const scene = useScene()
setPropertiesInvalidator(scene.invalidateProperties)
const inputMapping = useInputMapping(scene)
const dispatcher = useDispatcher()
const actions = useActions(scene, inputMapping, dispatcher)
const state = useUIState()
const categories = buildCategories()

provide('runAction', actions.runAction)
provide('rebuildSync', actions.rebuildSync)
provide('dispatcher', dispatcher)

// ── Register operator run handlers + seed defaults ──────

for (const op of operators.all()) {
  actions.register(`${op.id}.run`, () => actions.runFromUI(op.id))
  for (const input of op.inputs) {
    const handler = getUIInputHandler(op.id, input.name)
    if (handler) {
      for (const sub of handler.inputs(null)) {
        if (sub.default !== undefined) state[`${op.id}.${input.name}.${sub.name}`] = sub.default
      }
      continue
    }
    if (input.default !== undefined) state[`${op.id}.${input.name}`] = input.default
  }
}

// ── Viewport ────────────────────────────────────────────

const viewportRef = ref<HTMLElement | null>(null)
let viewport: ReturnType<typeof useViewport> | null = null
const interactionMode = shallowRef<import('@/viewport/useInteraction').InteractionMode>('move')
const stickyInteractionMode = shallowRef<import('@/viewport/useInteraction').InteractionMode | null>(null)
const lockedAxisRef = shallowRef<import('@/viewport/useInteraction').AxisLock>(null)
provide('interactionMode', interactionMode)
provide('stickyInteractionMode', stickyInteractionMode)
provide('lockedAxis', lockedAxisRef)
provide(
  'viewportCamera',
  computed(() => viewport?.camera ?? null),
)
provide('setAxisLock', (axis: import('@/viewport/useInteraction').AxisLock) => viewport?.setAxisLock(axis))
provide('rotateSelection90', (axis: 'X' | 'Y' | 'Z') => viewport?.rotateSelection90(axis))
provide('alignCameraToAxis', (axis: string) => viewport?.alignCameraToAxis(axis))
provide('snapCameraToAxis', (axis: string) => viewport?.snapCameraToAxis(axis))
provide('toggleStickyTransform', () => viewport?.toggleStickyTransform())
provide('toggleStickyOrbit', () => viewport?.toggleStickyOrbit())

const getViewport = () => viewport

// ── File IO + Showcase ──────────────────────────────────

const { importFile, importFromUrl, exportSelection, onDragOver, onDrop } = useFileIO(scene, dispatcher, getViewport)
const { downloadAndShowcase } = useShowcase(scene, dispatcher, getViewport)

actions.register('io-open', () => {
  trackOperation('user', 'io-open')
  const input = document.createElement('input')
  input.type = 'file'
  input.accept = '.stl,.obj'
  input.multiple = true
  input.onchange = () => {
    if (input.files) Array.from(input.files).forEach(importFile)
  }
  input.click()
})
actions.register('io-export-stl', () => {
  trackOperation('user', 'io-export-stl')
  exportSelection('stl')
})
actions.register('io-export-obj', () => {
  trackOperation('user', 'io-export-obj')
  exportSelection('obj')
})

// ── Overlay state ───────────────────────────────────────

const activeDrillIn = ref<DrillIn | null>(null)
const showSettings = ref(false)
const showHelp = ref(false)
const showMcp = ref(false)
const activeMobilePanel = ref<MobilePanelKind | null>(null)
const hasRunningTask = computed(() => dispatcher.tasks.some((t) => t.status === 'running'))

const { isMobile } = useBreakpoint()

watch(isMobile, (mobile) => {
  if (!mobile) activeMobilePanel.value = null
})

function closeMobilePanel() {
  activeMobilePanel.value = null
}

// Same back-cascade as the global Escape handler. Used by viewport tap-empty
// so a tap on empty space backs out the most-specific UI state first
// (axis lock, sticky mode, ContextPanel drill-in, mobile panel) and only
// clears the active selection when no UI state was active.
function onViewportEmptyTap(): boolean {
  if (viewport?.clearAxisLock()) return true
  if (viewport?.clearStickyMode()) return true
  if (contextPanelRef.value?.handleEscape()) return true
  if (isMobile.value && activeMobilePanel.value !== null) {
    activeMobilePanel.value = null
    return true
  }
  return false
}
const commandOpen = ref(false)
const showWizard = ref(!prefs.skipOnboarding)
const contextPanelRef = ref<{ handleEscape: () => boolean } | null>(null)

actions.register('open-settings', () => {
  showSettings.value = true
})
actions.register('open-help', () => {
  showHelp.value = true
})

watch(commandOpen, (isOpen) => {
  if (!isOpen) return
  showSettings.value = false
  showHelp.value = false
  showMcp.value = false
})

// ── Onboarding wizard ───────────────────────────────────

function onWizardDownload(name: string, url: string) {
  showWizard.value = false
  downloadAndShowcase(name, url)
}
function onWizardImportFiles(files: File[]) {
  files.forEach(importFile)
  showWizard.value = false
}

// ── Global Escape handler ───────────────────────────────

function onGlobalKeyDown(e: KeyboardEvent) {
  if (showSettings.value || showHelp.value || showMcp.value || commandOpen.value || showWizard.value) return
  const tag = (document.activeElement as HTMLElement)?.tagName
  if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return

  if (e.key === 'Escape') {
    if (viewport?.clearAxisLock()) {
      e.preventDefault()
      return
    }
    if (viewport?.clearStickyMode()) {
      e.preventDefault()
      return
    }
    if (contextPanelRef.value?.handleEscape()) {
      e.preventDefault()
      return
    }
  }

  if (e.key === 'f' || e.key === 'F') {
    if (scene.activeSelection.length > 0) {
      requestAnimationFrame(() => viewport?.fitToNodes([...scene.activeSelection]))
    } else {
      requestAnimationFrame(() => viewport?.fitToScene())
    }
    e.preventDefault()
  }
}
window.addEventListener('keydown', onGlobalKeyDown)
onBeforeUnmount(() => {
  window.removeEventListener('keydown', onGlobalKeyDown)
})

// ── MCP ─────────────────────────────────────────────────

const mcpHandle = shallowRef<ReturnType<typeof useMCP> | null>(null)

const handlerContext: import('@/mcp/handler').HandlerContext = {
  scene,
  actions,
  dispatcher,
  getViewport,
  importFromUrl,
  exportSelection,
}

onMounted(() => {
  if (viewportRef.value) {
    viewport = useViewport(viewportRef.value, scene, { onEmptyTap: onViewportEmptyTap })
    watch(viewport.mode, (m) => (interactionMode.value = m), { immediate: true })
    watch(viewport.stickyMode, (m) => (stickyInteractionMode.value = m), { immediate: true })
    watch(viewport.lockedAxis, (a) => (lockedAxisRef.value = a), { immediate: true })
  }
  mcpHandle.value = useMCP(handlerContext)
})

function onBeforeUnload(e: BeforeUnloadEvent) {
  if (!prefs.preventRefresh || scene.nodes.size === 0) return
  e.preventDefault()
  e.returnValue = ''
}
window.addEventListener('beforeunload', onBeforeUnload)
onBeforeUnmount(() => {
  window.removeEventListener('beforeunload', onBeforeUnload)
  mcpHandle.value?.dispose()
  viewport?.dispose()
})
</script>

<template>
  <UApp>
    <div class="relative w-dvw h-dvh overflow-hidden" @dragover="onDragOver" @drop="onDrop">
      <!-- Full-screen 3D viewport -->
      <div ref="viewportRef" class="absolute inset-0 w-full h-full three-bg touch-none select-none" />

      <!-- Mobile scrim: closes the active panel on viewport tap without
           letting the tap reach the viewport's selection handlers. -->
      <div
        v-if="isMobile && activeMobilePanel"
        class="absolute inset-0 z-[5]"
        @pointerdown="closeMobilePanel"
      />

      <!-- ── Desktop / tablet layout (≥md) ──────────────────────── -->
      <template v-if="!isMobile">
        <!-- Left column: header + context panel -->
        <div class="absolute left-safe-left top-safe-top bottom-safe-bottom z-10 pointer-events-none flex flex-col gap-panel-gap w-[22rem]">
          <AppHeader
            :actions="actions"
            :mcp-handle="mcpHandle"
            v-model:show-settings="showSettings"
            v-model:show-help="showHelp"
            v-model:show-mcp="showMcp"
            v-model:show-command="commandOpen"
          />
          <ContextPanel
            ref="contextPanelRef"
            class="pointer-events-auto min-h-0"
            v-model:drill-in="activeDrillIn"
            :scene="scene"
            :categories="categories"
            :input-mapping="inputMapping"
            @download="downloadAndShowcase"
          />
        </div>

        <!-- Right column: Object list + task panel -->
        <div
          class="absolute right-safe-right top-safe-top bottom-safe-bottom z-10 pointer-events-none flex flex-col items-end gap-panel-gap w-80"
        >
          <ObjectList class="pointer-events-auto shrink min-h-0 w-full" :scene="scene" />
          <div class="flex-1" />
          <TaskPanel class="pointer-events-auto shrink min-h-0" :dispatcher="dispatcher" />
        </div>

        <!-- Top center: SelectionBar -->
        <div class="absolute top-safe-top left-1/2 -translate-x-1/2 z-10 pointer-events-none">
          <SelectionBar :scene="scene" :get-viewport="getViewport" />
        </div>

        <!-- Bottom center: Mode indicator -->
        <div class="absolute bottom-safe-bottom left-1/2 -translate-x-1/2 z-10 pointer-events-none">
          <ModeIndicator class="pointer-events-auto" />
        </div>
      </template>

      <!-- ── Mobile layout (<md) ────────────────────────────────── -->
      <template v-else>
        <div class="absolute top-safe-top left-safe-left right-safe-right z-20 pointer-events-none flex flex-col gap-panel-gap">
          <!-- Top row: launcher (left), mode (center), header (right) -->
          <div class="flex flex-row items-start justify-between gap-2">
            <MobilePanelLauncher v-model:active="activeMobilePanel" :has-running-task="hasRunningTask" />
            <ModeIndicator class="pointer-events-auto" />
            <AppHeader
              class="pointer-events-auto"
              :actions="actions"
              :mcp-handle="mcpHandle"
              v-model:show-settings="showSettings"
              v-model:show-help="showHelp"
              v-model:show-mcp="showMcp"
              v-model:show-command="commandOpen"
            />
          </div>

          <!-- Sliding panel below the launcher -->
          <Transition name="mobile-panel">
            <div
              v-if="activeMobilePanel"
              class="pointer-events-none flex flex-col gap-panel-gap max-h-[60dvh] min-h-0"
            >
              <ContextPanel
                v-if="activeMobilePanel === 'tools'"
                ref="contextPanelRef"
                class="min-h-0"
                v-model:drill-in="activeDrillIn"
                :scene="scene"
                :categories="categories"
                :input-mapping="inputMapping"
                @download="downloadAndShowcase"
              />
              <ObjectList
                v-else-if="activeMobilePanel === 'objects'"
                class="pointer-events-auto min-h-0 w-full"
                :scene="scene"
              />
              <TaskPanel
                v-else-if="activeMobilePanel === 'tasks'"
                class="pointer-events-auto min-h-0"
                :dispatcher="dispatcher"
              />
            </div>
          </Transition>
        </div>

        <!-- Bottom center: ActiveTaskChip alone (selection moved to corner) -->
        <div class="absolute bottom-safe-bottom left-1/2 -translate-x-1/2 z-10 pointer-events-none">
          <ActiveTaskChip :dispatcher="dispatcher" @open="activeMobilePanel = 'tasks'" />
        </div>

        <!-- Bottom-right: compact selection count chip with popover -->
        <div class="absolute bottom-safe-bottom right-safe-right z-10 pointer-events-none">
          <SelectionCountChip :scene="scene" :get-viewport="getViewport" />
        </div>
      </template>

      <!-- Command palette (Cmd+K) -->
      <CommandSearch v-model:open="commandOpen" v-model:drill-in="activeDrillIn" :categories="categories" />

      <!-- Bottom left: Axes widget -->
      <div class="absolute bottom-safe-bottom left-safe-left z-0 pointer-events-none">
        <AxesWidget class="size-20 pointer-events-auto" />
      </div>

      <!-- Onboarding wizard -->
      <OnboardingWizard
        v-if="showWizard"
        @dismiss="showWizard = false"
        @download="onWizardDownload"
        @import-files="onWizardImportFiles"
      />
    </div>
  </UApp>
</template>

<style scoped>
.three-bg {
  background:
    radial-gradient(circle at 50% 40%, var(--ln-bg-glow), transparent 60%),
    linear-gradient(135deg, var(--ln-bg-gradient-start) 0%, var(--ln-bg-gradient-mid) 55%, var(--ln-bg-gradient-end) 100%);
}

.mobile-panel-enter-active,
.mobile-panel-leave-active {
  transition:
    transform 220ms cubic-bezier(0.2, 0, 0, 1),
    opacity 180ms ease;
  transform-origin: top left;
}
.mobile-panel-enter-from,
.mobile-panel-leave-to {
  transform: translateY(-8px) scale(0.98);
  opacity: 0;
}
</style>
