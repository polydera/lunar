<script setup lang="ts">
import { computed, inject, type ShallowRef } from 'vue'
import { cameraRotation } from '@/viewport/cameraState'
import type { InteractionMode, AxisLock } from '@/viewport/useInteraction'

const mode = inject<ShallowRef<InteractionMode>>('interactionMode')
const lockedAxis = inject<ShallowRef<AxisLock>>('lockedAxis')
const setAxisLock = inject<(axis: AxisLock) => void>('setAxisLock')
const rotateSelection90 = inject<(axis: 'X' | 'Y' | 'Z') => void>('rotateSelection90')
const alignCameraToAxis = inject<(axis: string) => void>('alignCameraToAxis')
const snapCameraToAxis = inject<(axis: string) => void>('snapCameraToAxis')

const VB = 100
const C = VB / 2
const ARM = 28
const POS_D = 38 // positive label distance
const NEG_D = 38 // negative dot distance (same as positive)
const HIT_R = 10 // hit target radius
const NEG_R = 6 // smaller visual radius for negative dots

const COLORS: Record<string, string> = {
  X: '#ff6b6b',
  Y: '#a9e34b',
  Z: '#339af0',
}
const ACCENT = 'var(--ln-accent)'

interface DotInfo {
  /** Axis name: X, Y, Z */
  axis: string
  /** Axis key for alignCameraToAxis: X, -X, Y, -Y, Z, -Z */
  key: string
  /** Is this the positive end? */
  positive: boolean
  // Screen positions
  lx: number
  ly: number // line endpoint
  tx: number
  ty: number // dot center
  depth: number
  color: string
  opacity: number
  locked: boolean
}

const sortedDots = computed<DotInfo[]>(() => {
  const r = cameraRotation.value
  const lock = lockedAxis?.value
  const dots: DotInfo[] = []

  for (const [col, name] of [
    [0, 'X'],
    [1, 'Y'],
    [2, 'Z'],
  ] as [number, string][]) {
    const sx = r[col]!
    const sy = r[col + 3]!
    const sz = r[col + 6]!
    const isLocked = lock === name

    // Positive end (+axis)
    dots.push({
      axis: name,
      key: name,
      positive: true,
      lx: C + sx * ARM,
      ly: C - sy * ARM,
      tx: C + sx * POS_D,
      ty: C - sy * POS_D,
      depth: sz,
      color: isLocked ? ACCENT : COLORS[name]!,
      opacity: sz < -0.1 ? 0.3 : 1,
      locked: isLocked,
    })

    // Negative end (-axis)
    dots.push({
      axis: name,
      key: `-${name}`,
      positive: false,
      lx: C - sx * ARM,
      ly: C + sy * ARM,
      tx: C - sx * NEG_D,
      ty: C + sy * NEG_D,
      depth: -sz,
      color: isLocked ? ACCENT : COLORS[name]!,
      opacity: -sz < -0.1 ? 0.2 : 0.5,
      locked: isLocked,
    })
  }

  return dots.sort((a, b) => a.depth - b.depth)
})

// Only draw lines once per axis (from center to positive end)
const axisLines = computed(() => {
  const r = cameraRotation.value
  const lock = lockedAxis?.value
  return (['X', 'Y', 'Z'] as const)
    .map((name, col) => {
      const sx = r[col]!
      const sy = r[col + 3]!
      const sz = r[col + 6]!
      const isLocked = lock === name
      return {
        name,
        // Draw full line through center: negative end to positive end
        x1: C - sx * ARM,
        y1: C + sy * ARM,
        x2: C + sx * ARM,
        y2: C - sy * ARM,
        color: isLocked ? ACCENT : COLORS[name]!,
        // Use the more visible of the two ends
        opacity: Math.max(sz < -0.1 ? 0.3 : 1, -sz < -0.1 ? 0.2 : 0.5) * 0.7,
      }
    })
    .sort((a, b) => {
      // Sort by max absolute depth (draw deepest first)
      const r = cameraRotation.value
      const depthA = Math.abs(r[['X', 'Y', 'Z'].indexOf(a.name) + 6]!)
      const depthB = Math.abs(r[['X', 'Y', 'Z'].indexOf(b.name) + 6]!)
      return depthA - depthB
    })
})

// Click: rotate 90° around axis
// Shift+click: toggle axis lock
// Alt+click: snap to axis view
function onDotClick(dot: DotInfo, e: MouseEvent) {
  if (e.shiftKey) {
    if (!setAxisLock) return
    setAxisLock(lockedAxis?.value === dot.axis ? null : (dot.axis as AxisLock))
    return
  }

  if (e.altKey) {
    snapCameraToAxis?.(dot.key)
    return
  }

  const m = mode?.value ?? 'move'
  if (m === 'transform') {
    rotateSelection90?.(dot.axis as 'X' | 'Y' | 'Z')
    return
  }

  alignCameraToAxis?.(dot.key)
}
</script>

<template>
  <svg :viewBox="`0 0 ${VB} ${VB}`" class="select-none" style="pointer-events: none">
    <!-- Subtle center ring -->
    <circle :cx="C" :cy="C" r="3" fill="none" stroke="var(--ln-accent)" stroke-width="0.5" opacity="0.3" />

    <!-- Axis lines (full length, drawn first) -->
    <line
      v-for="line in axisLines"
      :key="line.name"
      :x1="line.x1"
      :y1="line.y1"
      :x2="line.x2"
      :y2="line.y2"
      :stroke="line.color"
      stroke-width="1.5"
      stroke-linecap="round"
      :opacity="line.opacity"
    />

    <!-- Dots (depth-sorted) -->
    <g v-for="dot in sortedDots" :key="dot.key">
      <!-- Hit target (invisible, generous) -->
      <circle
        :cx="dot.tx"
        :cy="dot.ty"
        :r="HIT_R"
        fill="transparent"
        style="pointer-events: auto; cursor: pointer"
        @click="onDotClick(dot, $event)"
      />

      <!-- Visual dot -->
      <circle
        v-if="dot.positive"
        :cx="dot.tx"
        :cy="dot.ty"
        :r="8"
        :fill="dot.locked ? 'var(--ln-accent)' : dot.color"
        :fill-opacity="dot.locked ? 0.3 : 0.15"
        :stroke="dot.color"
        :stroke-width="dot.locked ? 1.5 : 1"
        :opacity="dot.opacity"
        style="pointer-events: none"
      />
      <circle
        v-else
        :cx="dot.tx"
        :cy="dot.ty"
        :r="NEG_R"
        fill="none"
        :stroke="dot.color"
        stroke-width="1"
        :opacity="dot.opacity"
        style="pointer-events: none"
      />

      <!-- Label: letter on positive, nothing on negative -->
      <text
        v-if="dot.positive"
        :x="dot.tx"
        :y="dot.ty"
        :fill="dot.color"
        font-size="10"
        font-weight="bold"
        text-anchor="middle"
        dominant-baseline="central"
        :opacity="dot.opacity"
        style="pointer-events: none"
      >
        {{ dot.axis }}
      </text>
    </g>
  </svg>
</template>
