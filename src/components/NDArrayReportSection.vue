<script setup lang="ts">
import { computed } from 'vue'
import type { NDArrayReport } from '@/composables/useReport'
import Separator from './Separator.vue'
import { formatCount, formatScalar } from '@/utils/format'

const props = defineProps<{ report: NDArrayReport }>()

const shapeLabel = computed(() => `[${props.report.shape.map(formatCount).join(' × ')}]`)

// SVG histogram geometry
const HIST_W = 240 // total width in px
const HIST_H = 60 // total height in px
const BAR_GAP = 1 // gap between bars in px

const histogramBars = computed(() => {
  const hist = props.report.histogram
  if (!hist || hist.bins.length === 0) return []
  const maxCount = Math.max(...hist.bins)
  if (maxCount === 0) return []
  const barW = Math.max(0.1, (HIST_W - BAR_GAP * (hist.bins.length - 1)) / hist.bins.length)
  return hist.bins.map((count, i) => {
    const h = (count / maxCount) * HIST_H
    return {
      x: i * (barW + BAR_GAP),
      y: HIST_H - h,
      w: barW,
      h,
    }
  })
})
</script>

<template>
  <div class="flex flex-col gap-2">
    <section class="flex flex-col gap-1">
      <h3 class="uppercase text-[10px] font-bold text-[var(--ln-accent)] px-1">Overview</h3>
      <div class="grid grid-cols-2 gap-x-4 gap-y-1 px-2 text-xs">
        <span class="text-default/50">Shape</span>
        <span class="text-default font-mono text-right">{{ shapeLabel }}</span>
        <span class="text-default/50">Dtype</span>
        <span class="text-default font-mono text-right">{{ report.dtype }}</span>
        <span class="text-default/50">Length</span>
        <span class="text-default font-mono text-right">{{ formatCount(report.length) }}</span>
        <template v-if="report.dtype === 'float32'">
          <span :class="report.nanCount > 0 ? 'text-orange-400/80' : 'text-default/50'">NaN values</span>
          <span class="font-mono text-right" :class="report.nanCount > 0 ? 'text-orange-400' : 'text-default/40'">{{
            formatCount(report.nanCount)
          }}</span>
        </template>
      </div>
    </section>

    <Separator />

    <section class="flex flex-col gap-1">
      <h3 class="uppercase text-[10px] font-bold text-[var(--ln-accent)] px-1">Stats</h3>
      <div class="grid grid-cols-2 gap-x-4 gap-y-1 px-2 text-xs">
        <span class="text-default/50">Min</span>
        <span class="text-default font-mono text-right">{{ formatScalar(report.stats.min) }}</span>
        <span class="text-default/50">Max</span>
        <span class="text-default font-mono text-right">{{ formatScalar(report.stats.max) }}</span>
        <span class="text-default/50">Mean</span>
        <span class="text-default font-mono text-right">{{ formatScalar(report.stats.mean) }}</span>
        <span class="text-default/50">Std</span>
        <span class="text-default font-mono text-right">{{ formatScalar(report.stats.std) }}</span>
      </div>
    </section>

    <template v-if="report.components && report.components.length > 0">
      <Separator />
      <section class="flex flex-col gap-1">
        <h3 class="uppercase text-[10px] font-bold text-[var(--ln-accent)] px-1">Components</h3>
        <div class="px-2 text-xs">
          <div class="grid grid-cols-5 gap-x-2 text-[10px] text-default/40 pb-1">
            <span></span>
            <span class="text-right">Min</span>
            <span class="text-right">Max</span>
            <span class="text-right">Mean</span>
            <span class="text-right">Std</span>
          </div>
          <div v-for="(c, i) in report.components" :key="i" class="grid grid-cols-5 gap-x-2 font-mono">
            <span class="text-default/50">{{ ['X', 'Y', 'Z', 'W'][i] ?? i }}</span>
            <span class="text-default text-right">{{ formatScalar(c.min) }}</span>
            <span class="text-default text-right">{{ formatScalar(c.max) }}</span>
            <span class="text-default text-right">{{ formatScalar(c.mean) }}</span>
            <span class="text-default text-right">{{ formatScalar(c.std) }}</span>
          </div>
        </div>
      </section>
    </template>

    <template v-if="report.histogram">
      <Separator />
      <section class="flex flex-col gap-1">
        <h3 class="uppercase text-[10px] font-bold text-[var(--ln-accent)] px-1">Distribution</h3>
        <div v-if="report.histogram.nanCount > 0" class="px-2 text-xs text-orange-400/80">
          {{ formatCount(report.histogram.nanCount) }} NaN value{{ report.histogram.nanCount > 1 ? 's' : '' }} filtered
        </div>
        <div v-if="histogramBars.length > 0" class="px-2 flex flex-col gap-1">
          <svg
            :viewBox="`0 0 ${HIST_W} ${HIST_H}`"
            :width="HIST_W"
            :height="HIST_H"
            class="w-full h-auto"
            preserveAspectRatio="none"
          >
            <rect
              v-for="(bar, i) in histogramBars"
              :key="i"
              :x="bar.x"
              :y="bar.y"
              :width="bar.w"
              :height="bar.h"
              fill="var(--ln-accent)"
            />
          </svg>
          <div class="flex justify-between text-[10px] font-mono text-default/40">
            <span>{{ formatScalar(report.histogram.min) }}</span>
            <span>{{ report.histogram.bins.length }} bins</span>
            <span>{{ formatScalar(report.histogram.max) }}</span>
          </div>
        </div>
      </section>
    </template>
  </div>
</template>
