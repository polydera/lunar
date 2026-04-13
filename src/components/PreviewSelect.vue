<script setup lang="ts">
const props = defineProps<{
  label: string
  multiple?: boolean
  items: { label: string; value: string; preview?: string | null }[]
}>()

const selectedItemImgs = (val: string | string[] | undefined): string[] | undefined => {
  if (!val) return undefined
  if (Array.isArray(val)) {
    return val.map((v) => props.items.find((item) => item.value === v)?.preview).filter((v) => !!v) as string[]
  }
  const p = props.items.find((item) => item.value === val)?.preview
  return p ? [p] : undefined
}
</script>
<template>
  <UFormField :label="label" class="px-2 w-full">
    <USelectMenu :items="items" value-key="value" leading :search-input="false" :multiple="multiple">
      <template #default="{ modelValue }">
        <div class="flex items-center gap-2">
          <div class="flex flex-row gap-0.5">
            <img
              v-for="img in (selectedItemImgs(modelValue) ?? []).slice(0, 3)"
              :key="img"
              :src="img!"
              class="h-8 w-auto max-w-12 rounded-sm object-contain"
            />
          </div>
        </div>
        <span v-if="!modelValue || modelValue.length === 0">Select {{ label.toLowerCase() }}{{ multiple ? 's' : '' }}</span>
        <span v-if="modelValue && !multiple">
          {{ items.find((item) => item.value === modelValue)?.label }}
        </span>
        <span v-if="modelValue && modelValue.length > 0 && multiple" class="truncate">
          {{ modelValue.length }} selected
        </span>
      </template>
      <template #item-leading="{ item }">
        <img :src="item.preview" v-if="item.preview" class="h-8 w-12 rounded-sm object-contain" />
      </template>
    </USelectMenu>
  </UFormField>
</template>
