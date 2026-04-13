<script setup lang="ts">
import type { MeshReport } from '@/composables/useReport'
import Separator from './Separator.vue'
import { formatCount, formatScalar } from '@/utils/format'

defineProps<{ report: MeshReport }>()
</script>

<template>
  <div class="flex flex-col gap-2">
    <!-- Quality -->
    <section class="flex flex-col gap-1">
      <h3 class="uppercase text-[10px] font-bold text-[var(--ln-accent)] px-1">Quality</h3>
      <div
        class="flex items-center gap-2 px-2 py-1.5 rounded-md text-xs"
        :class="report.issues.length === 0 ? 'bg-emerald-500/10 text-emerald-400' : 'bg-orange-500/10 text-orange-400'"
      >
        <UIcon
          :name="report.issues.length === 0 ? 'i-lucide:circle-check' : 'i-lucide:alert-triangle'"
          class="size-4 shrink-0"
        />
        <span v-if="report.issues.length === 0">No issues found</span>
        <span v-else>{{ report.issues.length }} issue{{ report.issues.length > 1 ? 's' : '' }}</span>
      </div>
      <div class="flex flex-col gap-1 px-2 text-xs">
        <div class="flex items-center justify-between">
          <span class="text-default/50">Closed</span>
          <span :class="report.isClosed ? 'text-emerald-400' : 'text-orange-400'">{{ report.isClosed ? '✓' : '✗' }}</span>
        </div>
        <div v-if="report.boundaryEdgeCount > 0" class="pl-3 text-orange-400/70 font-mono">
          {{ report.boundaryEdgeCount }} boundary edges
        </div>

        <div class="flex items-center justify-between">
          <span class="text-default/50">Manifold</span>
          <span :class="report.isManifold ? 'text-emerald-400' : 'text-orange-400'">{{
            report.isManifold ? '✓' : '✗'
          }}</span>
        </div>
        <div v-if="report.nonManifoldEdgeCount > 0" class="pl-3 text-orange-400/70 font-mono">
          {{ report.nonManifoldEdgeCount }} non-manifold edges
        </div>

        <div class="flex items-center justify-between">
          <span class="text-default/50">No self-intersections</span>
          <span :class="report.hasSelfIntersections ? 'text-orange-400' : 'text-emerald-400'">{{
            report.hasSelfIntersections ? '✗' : '✓'
          }}</span>
        </div>
      </div>
    </section>

    <Separator />

    <!-- Overview -->
    <section class="flex flex-col gap-1">
      <h3 class="uppercase text-[10px] font-bold text-[var(--ln-accent)] px-1">Overview</h3>
      <div class="grid grid-cols-2 gap-x-4 gap-y-1 px-2 text-xs">
        <span class="text-default/50">Faces</span>
        <span class="text-default font-mono text-right">{{ formatCount(report.faces) }}</span>
        <span class="text-default/50">Vertices</span>
        <span class="text-default font-mono text-right">{{ formatCount(report.vertices) }}</span>
        <span class="text-default/50">Components</span>
        <span class="text-default font-mono text-right">{{ report.connectedComponents }}</span>
        <template v-if="report.obbExtent">
          <span class="text-default/50">Dimensions</span>
          <span class="text-default font-mono text-right"
            >{{ report.obbExtent[0] }} × {{ report.obbExtent[1] }} × {{ report.obbExtent[2] }}</span
          >
        </template>
      </div>
    </section>

    <Separator />

    <!-- Measurements -->
    <section class="flex flex-col gap-1">
      <h3 class="uppercase text-[10px] font-bold text-[var(--ln-accent)] px-1">Measurements</h3>
      <div class="grid grid-cols-2 gap-x-4 gap-y-1 px-2 text-xs">
        <span class="text-default/50">Surface area</span>
        <span class="text-default font-mono text-right">{{ formatScalar(report.area) }}</span>
        <span class="text-default/50">Volume</span>
        <span class="text-default font-mono text-right">{{ formatScalar(report.volume) }}</span>
      </div>
    </section>

    <template v-if="report.curvatureStats">
      <Separator />
      <section class="flex flex-col gap-1">
        <h3 class="uppercase text-[10px] font-bold text-[var(--ln-accent)] px-1">Curvature</h3>
        <div class="grid grid-cols-2 gap-x-4 gap-y-1 px-2 text-xs">
          <span class="text-default/50">Min</span>
          <span class="text-default font-mono text-right">{{ report.curvatureStats.min }}</span>
          <span class="text-default/50">Max</span>
          <span class="text-default font-mono text-right">{{ report.curvatureStats.max }}</span>
          <span class="text-default/50">Mean</span>
          <span class="text-default font-mono text-right">{{ report.curvatureStats.mean }}</span>
          <span class="text-default/50">Std</span>
          <span class="text-default font-mono text-right">{{ report.curvatureStats.std }}</span>
        </div>
      </section>
    </template>
  </div>
</template>
