<script setup lang="ts">
defineProps<{
  title: string
}>()

const open = ref(true)
</script>
<template>
  <UCollapsible :unmount-on-hide="false" v-model:open="open" class="flex flex-col gap-1">
    <div class="flex flex-row gap-3 justify-between items-center rounded-md px-2 py-1 cursor-pointer">
      <h3 class="uppercase text-base font-bold select-none">{{ title }}</h3>
      <UIcon
        name="i-hugeicons:arrow-up-01"
        class="size-6 cursor-pointer transition-transform duration-300 ease-in-out"
        :class="{ 'rotate-0': open, 'rotate-180': !open }"
      />
    </div>
    <template #content>
      <slot />
    </template>
  </UCollapsible>
</template>
