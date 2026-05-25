<script setup lang="ts">
import { ref, watch } from 'vue'
import { useSelectionActions } from '@/composables/useSelectionActions'
import type { useScene } from '@/scene/useScene'
import type { useViewport } from '@/viewport/useViewport'

type Scene = ReturnType<typeof useScene>
type Viewport = ReturnType<typeof useViewport>

const props = defineProps<{
  scene: Scene
  getViewport: () => Viewport | null
}>()

const sel = useSelectionActions(props.scene, props.getViewport)
const open = ref(false)

// Auto-dismiss when selection becomes empty.
watch(
  () => props.scene.activeSelection.length,
  (n) => {
    if (n === 0) open.value = false
  },
)

// Close popover after destructive / one-shot actions; keep open for color/opacity sub-popovers.
function runAndClose(fn: () => void) {
  fn()
  open.value = false
}
</script>

<template>
  <Transition name="bar-bottom" mode="out-in">
    <UPopover v-if="scene.activeSelection.length > 0" v-model:open="open" :ui="{ content: 'bg-transparent border-0 shadow-none p-0' }">
      <WidgetMenu class="pointer-events-auto px-2 py-1 cursor-pointer">
        <div class="flex flex-row gap-1.5 items-center h-7">
          <UIcon name="i-lucide:box-select" class="size-4 text-[var(--ln-accent)]" />
          <span class="text-sm font-semibold tabular-nums">{{ scene.activeSelection.length }}</span>
        </div>
      </WidgetMenu>

      <template #content>
        <WidgetMenu class="pointer-events-auto">
          <div class="flex flex-row gap-1 items-center px-1">
            <UButton
              variant="ghost"
              color="neutral"
              size="md"
              icon="i-lucide:trash-2"
              aria-label="Delete"
              @click="runAndClose(sel.deleteSelection)"
            />
            <UButton
              variant="ghost"
              color="neutral"
              size="md"
              icon="i-lucide:copy"
              aria-label="Duplicate"
              @click="runAndClose(sel.duplicateSelection)"
            />
            <Separator direction="vertical" />
            <UButton
              variant="ghost"
              color="neutral"
              size="md"
              icon="i-lucide:box"
              aria-label="Solid"
              :class="{ 'text-primary': sel.renderMode.value === 'solid' }"
              @click="sel.setRenderMode('solid')"
            />
            <UButton
              variant="ghost"
              color="neutral"
              size="md"
              icon="i-lucide:grid-3x3"
              aria-label="Wireframe"
              :class="{ 'text-primary': sel.renderMode.value === 'wireframe' }"
              @click="sel.setRenderMode('wireframe')"
            />
            <Separator direction="vertical" />
            <UPopover>
              <UButton variant="ghost" color="neutral" size="md" icon="i-lucide:palette" aria-label="Color" />
              <template #content>
                <div class="p-2">
                  <UColorPicker v-model="sel.color.value" @update:model-value="sel.setColor" />
                </div>
              </template>
            </UPopover>
            <UPopover>
              <UButton variant="ghost" color="neutral" size="md" icon="i-lucide:blend" aria-label="Opacity" />
              <template #content>
                <div class="p-3 w-40">
                  <USlider v-model="sel.opacity.value" :min="0" :max="100" @update:model-value="sel.setOpacity" />
                  <div class="text-xs text-default/60 text-center mt-1">{{ sel.opacity.value }}%</div>
                </div>
              </template>
            </UPopover>
            <Separator direction="vertical" />
            <UButton
              variant="ghost"
              color="neutral"
              size="md"
              icon="i-lucide:focus"
              aria-label="Focus"
              @click="runAndClose(sel.focusSelection)"
            />
          </div>
        </WidgetMenu>
      </template>
    </UPopover>
  </Transition>
</template>
