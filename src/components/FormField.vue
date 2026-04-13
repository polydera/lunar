<script setup lang="ts">
defineProps<{
  label: string
  description?: string
}>()
</script>
<template>
  <div class="flex flex-row gap-3 justify-between items-center px-2 w-full">
    <UTooltip v-if="description" :text="description" class="flex-1">
      <span class="text-sm text-highlighted cursor-help">{{ label }}</span>
    </UTooltip>
    <span v-else class="text-sm text-highlighted flex-1">{{ label }}</span>
    <div class="w-40 flex justify-end">
      <slot />
    </div>
  </div>
</template>
