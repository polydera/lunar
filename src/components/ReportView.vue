<script setup lang="ts">
import type { OperandReport } from '@/composables/useReport'
import Separator from './Separator.vue'
import MeshReportSection from './MeshReportSection.vue'
import CurvesReportSection from './CurvesReportSection.vue'
import NDArrayReportSection from './NDArrayReportSection.vue'

defineProps<{ reports: OperandReport[] }>()
</script>

<template>
  <div class="flex flex-col gap-2 px-1 overflow-y-auto max-h-[60vh]">
    <div v-for="(r, idx) in reports" :key="r.operandId" class="flex flex-col gap-2">
      <h4 v-if="reports.length > 1" class="text-xs font-bold text-[var(--ln-accent)] uppercase tracking-wider px-1">
        {{ r.label }}
      </h4>

      <MeshReportSection v-if="r.kind === 'mesh'" :report="r" />
      <CurvesReportSection v-else-if="r.kind === 'curves'" :report="r" />
      <NDArrayReportSection v-else-if="r.kind === 'ndarray'" :report="r" />

      <Separator v-if="idx < reports.length - 1" class="my-1" />
    </div>
  </div>
</template>
