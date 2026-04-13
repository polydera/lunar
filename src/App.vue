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
import AppHeader from '@/components/layout/AppHeader.vue'
import SelectionBar from '@/components/layout/SelectionBar.vue'

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
  const input = document.createElement('input')
  input.type = 'file'
  input.accept = '.stl,.obj'
  input.multiple = true
  input.onchange = () => {
    if (input.files) Array.from(input.files).forEach(importFile)
  }
  input.click()
})
actions.register('io-export-stl', () => exportSelection('stl'))
actions.register('io-export-obj', () => exportSelection('obj'))

// ── Overlay state ───────────────────────────────────────

const activeDrillIn = ref<DrillIn | null>(null)
const showSettings = ref(false)
const showHelp = ref(false)
const showMcp = ref(false)
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
}

onMounted(() => {
  if (viewportRef.value) {
    viewport = useViewport(viewportRef.value, scene)
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
    <div class="relative w-screen h-screen overflow-hidden" @dragover="onDragOver" @drop="onDrop">
      <!-- Full-screen 3D viewport -->
      <div ref="viewportRef" class="absolute inset-0 w-full h-full three-bg touch-none select-none" />

      <!-- Left column: header + context panel -->
      <div class="absolute left-inset top-inset bottom-inset z-10 pointer-events-none flex flex-col gap-panel-gap w-[22rem]">
        <AppHeader
          :actions="actions"
          :mcp-handle="mcpHandle"
          v-model:show-settings="showSettings"
          v-model:show-help="showHelp"
          v-model:show-mcp="showMcp"
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

      <!-- Top center: Selection bar -->
      <SelectionBar :scene="scene" :get-viewport="getViewport" />

      <!-- Right column: Object list + task panel -->
      <div
        class="absolute right-inset top-inset bottom-inset z-10 pointer-events-none flex flex-col items-end gap-panel-gap w-80"
      >
        <ObjectList class="pointer-events-auto shrink-0 w-full" :scene="scene" />
        <div class="flex-1" />
        <TaskPanel class="pointer-events-auto shrink min-h-0" :dispatcher="dispatcher" />
      </div>

      <!-- Command palette (Cmd+K) -->
      <CommandSearch v-model:open="commandOpen" v-model:drill-in="activeDrillIn" :categories="categories" />

      <!-- Bottom left: Axes widget -->
      <div class="absolute bottom-inset left-inset z-0 pointer-events-none">
        <AxesWidget class="size-20 pointer-events-auto" />
      </div>

      <!-- Bottom center: Mode indicator -->
      <div class="absolute bottom-inset left-1/2 -translate-x-1/2 z-10 pointer-events-none">
        <ModeIndicator class="pointer-events-auto" />
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
</style>
