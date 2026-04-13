<script setup lang="ts">
defineProps<{
  label: string
  value: string
}>()
</script>
<template>
  <div class="flex flex-row gap-3 justify-between items-center text-sm w-full">
    <div class="font-semibold">{{ label }}</div>
    <div>{{ value }}</div>
  </div>
</template>
