<script setup lang="ts">
import type { CurvesReport } from '@/composables/useReport'
import Separator from './Separator.vue'
import { formatCount, formatScalar } from '@/utils/format'

defineProps<{ report: CurvesReport }>()
</script>

<template>
  <div class="flex flex-col gap-2">
    <section class="flex flex-col gap-1">
      <h3 class="uppercase text-[10px] font-bold text-[var(--ln-accent)] px-1">Overview</h3>
      <div class="grid grid-cols-2 gap-x-4 gap-y-1 px-2 text-xs">
        <span class="text-default/50">Paths</span>
        <span class="text-default font-mono text-right">{{ formatCount(report.paths) }}</span>
        <span class="text-default/50">Segments</span>
        <span class="text-default font-mono text-right">{{ formatCount(report.segments) }}</span>
        <span class="text-default/50">Vertex refs</span>
        <span class="text-default font-mono text-right">{{ formatCount(report.vertexRefs) }}</span>
        <template v-if="report.aabbExtent">
          <span class="text-default/50">Dimensions</span>
          <span class="text-default font-mono text-right"
            >{{ report.aabbExtent[0] }} × {{ report.aabbExtent[1] }} × {{ report.aabbExtent[2] }}</span
          >
        </template>
      </div>
    </section>

    <Separator />

    <section class="flex flex-col gap-1">
      <h3 class="uppercase text-[10px] font-bold text-[var(--ln-accent)] px-1">Measurements</h3>
      <div class="grid grid-cols-2 gap-x-4 gap-y-1 px-2 text-xs">
        <span class="text-default/50">Total length</span>
        <span class="text-default font-mono text-right">{{ formatScalar(report.totalLength) }}</span>
      </div>
    </section>
  </div>
</template>
