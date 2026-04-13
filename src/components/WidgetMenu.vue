<script setup lang="ts">
import { twMerge } from 'tailwind-merge'

const props = withDefaults(
  defineProps<{
    class?: string
  }>(),
  {
    class: '',
  },
)

const baseClasses =
  'w-fit rounded-lg bg-[var(--ln-panel)] shadow-lg backdrop-blur p-1.5 border-[length:var(--ln-panel-border-width)] border-[color:var(--ln-panel-border)]'
const mergedClasses = computed(() => twMerge(baseClasses, props.class))

const widgetMenu = useTemplateRef('widgetMenu')
defineExpose({
  widgetMenu,
})
</script>

<template>
  <div ref="widgetMenu" :class="mergedClasses">
    <slot />
  </div>
</template>
