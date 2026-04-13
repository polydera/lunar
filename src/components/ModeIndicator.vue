<script setup lang="ts">
import { inject, type ShallowRef } from 'vue'
import type { InteractionMode, AxisLock } from '@/viewport/useInteraction'

const mode = inject<ShallowRef<InteractionMode>>('interactionMode')
const stickyMode = inject<ShallowRef<InteractionMode | null>>('stickyInteractionMode')
const lockedAxis = inject<ShallowRef<AxisLock>>('lockedAxis')

interface ModeEntry {
  icon: string
  label: string
}

const modes: Record<InteractionMode, ModeEntry> = {
  move: { icon: 'i-hugeicons:move', label: 'Normal' },
  transform: { icon: 'i-hugeicons:rotate-clockwise', label: 'Transform' },
  orbit: { icon: 'i-hugeicons:orbit-01', label: 'Camera' },
  append: { icon: 'i-hugeicons:add-circle', label: 'Append' },
}

const AXIS_COLORS: Record<string, string> = {
  X: '#ff6b6b',
  Y: '#a9e34b',
  Z: '#339af0',
}

const toggleTransform = inject<() => void>('toggleStickyTransform')

const current = computed(() => modes[mode?.value ?? 'move'])
const isSticky = computed(() => stickyMode?.value != null)
const axisName = computed(() => lockedAxis?.value ?? null)
const axisColor = computed(() => (axisName.value ? AXIS_COLORS[axisName.value] : null))
const isTouchDevice = navigator.maxTouchPoints > 0

function onTap(e: PointerEvent) {
  if (e.pointerType !== 'touch') return
  toggleTransform?.()
}
</script>

<template>
  <WidgetMenu :class="isTouchDevice ? 'px-4 py-2 cursor-pointer' : 'px-4 py-2'" @pointerup="onTap">
    <div class="flex items-center gap-2.5 select-none">
      <UIcon :name="current.icon" class="size-5 text-[var(--ln-accent)]" />
      <span class="text-base">{{ current.label }}</span>
      <span
        v-if="isSticky"
        class="size-2 rounded-full bg-[var(--ln-accent)]"
        title="Locked mode — press N or Escape to release"
      />
      <span
        v-if="axisName"
        class="px-1.5 py-0.5 rounded text-[10px] font-bold leading-none border"
        :style="{ color: axisColor ?? undefined, borderColor: (axisColor ?? '') + '66' }"
        title="Axis lock — Shift+click axis or press N to release"
        >{{ axisName }}</span
      >
    </div>
  </WidgetMenu>
</template>
