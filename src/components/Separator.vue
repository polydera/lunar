<script setup lang="ts">
withDefaults(
  defineProps<{
    direction?: 'horizontal' | 'vertical'
  }>(),
  {
    direction: 'horizontal',
  },
)
</script>
<template>
  <div
    :class="{ 'h-0.5': direction === 'horizontal', 'w-0.5': direction === 'vertical' }"
    class="bg-[var(--ln-panel-border)] rounded-md mx-1 self-stretch"
  />
</template>
