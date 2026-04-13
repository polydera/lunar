<script setup lang="ts">
import * as tf from '@polydera/trueform'
import { operands } from '@/core'
import { copyTransform } from '@/core/utils'
import { defaults } from '@/setup/theme'
import type { useScene } from '@/scene/useScene'
import type { useViewport } from '@/viewport/useViewport'

type Scene = ReturnType<typeof useScene>
type Viewport = ReturnType<typeof useViewport>

const props = defineProps<{
  scene: Scene
  getViewport: () => Viewport | null
}>()

function deleteSelection() {
  const ids = [...props.scene.activeSelection]
  for (const id of ids) props.scene.removeNode(id)
}

function duplicateSelection() {
  for (const nodeId of [...props.scene.activeSelection]) {
    const node = props.scene.getNode(nodeId)
    if (!node?.operandId) continue
    const operand = operands.get(node.operandId)
    if (!operand || operand.type !== 'mesh') continue
    const original = operand.data as tf.Mesh
    const copy = original.shallowCopy()
    copyTransform(original, copy)
    const id = operands.nextId(node.label)
    operands.add({ id, type: 'mesh', data: copy })
    props.scene.addNode({
      id,
      label: `${node.label} copy`,
      parentId: null,
      order: 0,
      operandId: id,
      visible: true,
      color: node.color,
      opacity: node.opacity,
      renderMode: node.renderMode,
    })
  }
}

const selectionRenderMode = computed(() => {
  props.scene.tree.value // trigger re-evaluation on scene changes
  if (props.scene.activeSelection.length === 0) return 'solid'
  const node = props.scene.getNode(props.scene.activeSelection[0]!)
  return node?.renderMode ?? 'solid'
})

function setSelectionRenderMode(mode: 'solid' | 'wireframe' | 'points') {
  for (const id of props.scene.activeSelection) props.scene.setRenderMode(id, mode)
}

const selectionColor = computed({
  get() {
    props.scene.version.value
    if (props.scene.activeSelection.length === 1) {
      return props.scene.getNode(props.scene.activeSelection[0]!)?.color ?? defaults.objectColor
    }
    return defaults.objectColor
  },
  set(color: string) {
    for (const id of props.scene.activeSelection) props.scene.setColor(id, color)
  },
})

function setSelectionColor(color: string | undefined) {
  if (!color) return
  for (const id of props.scene.activeSelection) props.scene.setColor(id, color)
}

const selectionOpacity = computed({
  get() {
    props.scene.version.value
    if (props.scene.activeSelection.length === 1) {
      return props.scene.getNode(props.scene.activeSelection[0]!)?.opacity ?? 100
    }
    return 100
  },
  set(opacity: number) {
    for (const id of props.scene.activeSelection) props.scene.setOpacity(id, opacity)
  },
})

function setSelectionOpacity(opacity: number | undefined) {
  if (opacity == null) return
  for (const id of props.scene.activeSelection) props.scene.setOpacity(id, opacity)
}

function focusSelection() {
  requestAnimationFrame(() => props.getViewport()?.fitToNodes([...props.scene.activeSelection]))
}
</script>

<template>
  <Transition name="bar-top" mode="out-in">
    <WidgetMenu v-if="scene.activeSelection.length > 0" class="absolute top-inset left-1/2 -translate-x-1/2 z-10">
      <div class="flex flex-row gap-1 items-center px-1">
        <span class="text-sm text-default/60 px-2">
          <span class="text-[var(--ln-accent)] font-semibold">{{ scene.activeSelection.length }}</span>
          selected
        </span>
        <Separator direction="vertical" />
        <UTooltip text="Delete"
          ><UButton variant="ghost" color="neutral" size="md" icon="i-lucide:trash-2" @click="deleteSelection"
        /></UTooltip>
        <UTooltip text="Duplicate"
          ><UButton variant="ghost" color="neutral" size="md" icon="i-lucide:copy" @click="duplicateSelection"
        /></UTooltip>
        <Separator direction="vertical" />
        <UTooltip text="Solid"
          ><UButton
            variant="ghost"
            color="neutral"
            size="md"
            icon="i-lucide:box"
            :class="{ 'text-primary': selectionRenderMode === 'solid' }"
            @click="setSelectionRenderMode('solid')"
        /></UTooltip>
        <UTooltip text="Wireframe"
          ><UButton
            variant="ghost"
            color="neutral"
            size="md"
            icon="i-lucide:grid-3x3"
            :class="{ 'text-primary': selectionRenderMode === 'wireframe' }"
            @click="setSelectionRenderMode('wireframe')"
        /></UTooltip>
        <Separator direction="vertical" />
        <UPopover>
          <UTooltip text="Color"><UButton variant="ghost" color="neutral" size="md" icon="i-lucide:palette" /></UTooltip>
          <template #content>
            <div class="p-2">
              <UColorPicker v-model="selectionColor" @update:model-value="setSelectionColor" />
            </div>
          </template>
        </UPopover>
        <UPopover>
          <UTooltip text="Opacity"><UButton variant="ghost" color="neutral" size="md" icon="i-lucide:blend" /></UTooltip>
          <template #content>
            <div class="p-3 w-40">
              <USlider v-model="selectionOpacity" :min="0" :max="100" @update:model-value="setSelectionOpacity" />
              <div class="text-xs text-default/60 text-center mt-1">{{ selectionOpacity }}%</div>
            </div>
          </template>
        </UPopover>
        <Separator direction="vertical" />
        <UTooltip text="Focus"
          ><UButton variant="ghost" color="neutral" size="md" icon="i-lucide:focus" @click="focusSelection"
        /></UTooltip>
      </div>
    </WidgetMenu>
  </Transition>
</template>
