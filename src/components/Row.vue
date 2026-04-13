<script setup lang="ts">
import type { UIAction } from '@/types/ui'

defineProps<{
  items: UIAction[]
}>()
</script>
<template>
  <div class="flex flex-row gap-1 flex-wrap">
    <DynamicComponent
      v-for="(child, index) in items ?? []"
      :key="'id' in child.props ? child.props.id : index"
      :action="child"
    />
  </div>
</template>
