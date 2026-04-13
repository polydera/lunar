<script setup lang="ts">
import type { UIAction } from '@/types/ui'

defineProps<{
  items: UIAction[]
  align?: 'center' | 'start' | 'end'
}>()
</script>
<template>
  <div class="flex flex-col gap-1.5 items-start w-full">
    <DynamicComponent
      v-for="(child, index) in items ?? []"
      :key="'id' in child.props ? child.props.id : index"
      :action="child"
    />
  </div>
</template>
