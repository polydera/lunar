<script setup lang="ts">
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
</script>

<template>
  <Transition name="bar-bottom" mode="out-in">
    <WidgetMenu v-if="scene.activeSelection.length > 0" class="pointer-events-auto">
      <div class="flex flex-row gap-1 items-center px-1">
        <span class="text-sm text-default/60 px-2">
          <span class="text-[var(--ln-accent)] font-semibold">{{ scene.activeSelection.length }}</span>
          selected
        </span>
        <Separator direction="vertical" />
        <UTooltip text="Delete"
          ><UButton variant="ghost" color="neutral" size="md" icon="i-lucide:trash-2" @click="sel.deleteSelection"
        /></UTooltip>
        <UTooltip text="Duplicate"
          ><UButton variant="ghost" color="neutral" size="md" icon="i-lucide:copy" @click="sel.duplicateSelection"
        /></UTooltip>
        <Separator direction="vertical" />
        <UTooltip text="Solid"
          ><UButton
            variant="ghost"
            color="neutral"
            size="md"
            icon="i-lucide:box"
            :class="{ 'text-primary': sel.renderMode.value === 'solid' }"
            @click="sel.setRenderMode('solid')"
        /></UTooltip>
        <UTooltip text="Wireframe"
          ><UButton
            variant="ghost"
            color="neutral"
            size="md"
            icon="i-lucide:grid-3x3"
            :class="{ 'text-primary': sel.renderMode.value === 'wireframe' }"
            @click="sel.setRenderMode('wireframe')"
        /></UTooltip>
        <Separator direction="vertical" />
        <UPopover>
          <UTooltip text="Color"><UButton variant="ghost" color="neutral" size="md" icon="i-lucide:palette" /></UTooltip>
          <template #content>
            <div class="p-2">
              <UColorPicker v-model="sel.color.value" @update:model-value="sel.setColor" />
            </div>
          </template>
        </UPopover>
        <UPopover>
          <UTooltip text="Opacity"><UButton variant="ghost" color="neutral" size="md" icon="i-lucide:blend" /></UTooltip>
          <template #content>
            <div class="p-3 w-40">
              <USlider v-model="sel.opacity.value" :min="0" :max="100" @update:model-value="sel.setOpacity" />
              <div class="text-xs text-default/60 text-center mt-1">{{ sel.opacity.value }}%</div>
            </div>
          </template>
        </UPopover>
        <Separator direction="vertical" />
        <UTooltip text="Focus"
          ><UButton variant="ghost" color="neutral" size="md" icon="i-lucide:focus" @click="sel.focusSelection"
        /></UTooltip>
      </div>
    </WidgetMenu>
  </Transition>
</template>
