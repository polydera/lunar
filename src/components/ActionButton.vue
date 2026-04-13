<script setup lang="ts">
withDefaults(
  defineProps<{
    isConfirm?: boolean
  }>(),
  {
    isConfirm: false,
  },
)
</script>
<template>
  <UButton
    color="neutral"
    :variant="isConfirm ? 'solid' : 'ghost'"
    v-bind="$attrs"
    :ui="{
      base: isConfirm ? 'mt-3 mb-2 mx-auto' : '',
    }"
    :size="isConfirm ? 'lg' : 'md'"
  />
</template>
