<script setup lang="ts">
import { useElementHover } from '@vueuse/core'

withDefaults(
  defineProps<{
    items?: { label: string; icon: string; value: string; disabled?: boolean }[]
  }>(),
  {
    items: () => [],
  },
)

const model = defineModel<string>()

const menuRef = useTemplateRef<HTMLElement>('menu')
const isHovered = useElementHover(menuRef)

const expandedWidth = '12rem'
const collapsedWidth = '2.5rem'
const labelMaxWidth = '10rem'

const handleClick = (value: string) => {
  model.value = model.value === value ? undefined : value
}
</script>

<template>
  <nav
    ref="menu"
    class="relative flex flex-col gap-1 overflow-hidden transition-[width] duration-300 ease-in-out"
    :style="{ width: isHovered ? expandedWidth : collapsedWidth }"
  >
    <UButton
      v-for="item in items"
      :key="item.value"
      :variant="model === item.value ? 'ghost' : 'ghost'"
      :color="model === item.value ? 'primary' : 'neutral'"
      :disabled="item.disabled"
      class="relative overflow-hidden shrink-0 w-full min-w-0 p-2 transition-colors duration-200 flex items-center gap-0 justify-start"
      @click="handleClick(item.value)"
    >
      <UIcon v-if="item.icon" :name="item.icon" class="shrink-0 size-6" />
      <span
        v-if="item.label"
        class="whitespace-nowrap inline-block overflow-hidden transition-[opacity,max-width,padding] duration-300 ease-in-out text-base"
        :style="{
          maxWidth: isHovered ? labelMaxWidth : '0rem',
          opacity: isHovered ? 1 : 0,
          paddingLeft: isHovered ? '0.5rem' : '0rem',
        }"
      >
        {{ item.label }}
      </span>
    </UButton>
  </nav>
</template>

<style scoped>
/* Smooth width transitions */
nav {
  will-change: width;
}
</style>
