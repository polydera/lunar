<script setup lang="ts">
const props = withDefaults(
  defineProps<{
    variant?: string
    color?: string
  }>(),
  {
    variant: 'ghost',
    color: 'neutral',
  },
)
</script>
<template>
  <UButton
    v-bind="$attrs"
    :variant="props.variant"
    :color="props.color"
    :ui="{
      base: 'flex-col items-center gap-1',
      leadingIcon: 'size-6',
      label: 'text-xs',
    }"
  >
    <slot />
  </UButton>
</template>
