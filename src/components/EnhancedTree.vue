<script setup lang="ts">
import type { TreeItem } from '@nuxt/ui'

const props = defineProps<{
  items: TreeItem[]
  selected: string[]
  getKey?: (item: TreeItem) => string
}>()

const emit = defineEmits<{
  'update:selected': [ids: string[]]
}>()

const keyFn = computed(() => props.getKey ?? ((item: TreeItem) => (item as any).value))

function findItems(items: TreeItem[], ids: string[]): TreeItem[] {
  const result: TreeItem[] = []
  for (const item of items) {
    if (ids.includes(keyFn.value(item))) result.push(item)
    if (item.children) result.push(...findItems(item.children, ids))
  }
  return result
}

const selectedItems = computed(() => findItems(props.items, props.selected))

const expandedIds = ref<string[]>([])

function toggleExpand(id: string) {
  const idx = expandedIds.value.indexOf(id)
  if (idx !== -1) {
    expandedIds.value.splice(idx, 1)
  } else {
    expandedIds.value.push(id)
  }
}

let anchorId: string | null = null

function flattenIds(items: TreeItem[]): string[] {
  const out: string[] = []
  for (const item of items) {
    out.push(keyFn.value(item))
    if (item.children) out.push(...flattenIds(item.children))
  }
  return out
}

function onSelect(e: any) {
  const item = e.detail?.value
  const originalEvent = e.detail?.originalEvent as PointerEvent | undefined
  if (!item) return

  const id = keyFn.value(item)
  // Skip second click of a double-click (detail === 2)
  if (originalEvent && originalEvent.detail > 1) return

  const shift = originalEvent?.shiftKey ?? false
  const toggle = originalEvent?.metaKey || originalEvent?.ctrlKey || false

  const current = [...props.selected]

  if (shift && anchorId) {
    // Range select from anchor to id in tree order
    const flat = flattenIds(props.items)
    const a = flat.indexOf(anchorId)
    const b = flat.indexOf(id)
    if (a !== -1 && b !== -1) {
      const [start, end] = a < b ? [a, b] : [b, a]
      emit('update:selected', flat.slice(start, end + 1))
      return
    }
  }

  if (toggle) {
    const idx = current.indexOf(id)
    if (idx !== -1) {
      current.splice(idx, 1)
    } else {
      current.push(id)
    }
    anchorId = id
  } else {
    if (current.length === 1 && current[0] === id) {
      current.length = 0
      anchorId = null
    } else {
      current.length = 0
      current.push(id)
      anchorId = id
    }
  }

  emit('update:selected', current)
}

const hoveredId = ref<string | null>(null)
const itemElements = new Map<string, HTMLElement>()

function hover(id: string | null) {
  if (hoveredId.value && hoveredId.value !== id) {
    const prev = itemElements.get(hoveredId.value)
    if (prev) {
      prev.classList.remove('viewport-hover', 'viewport-hover-selected')
    }
  }

  hoveredId.value = id

  if (id) {
    const el = itemElements.get(id)
    if (el) {
      const isSelected = props.selected.includes(id)
      el.classList.toggle('viewport-hover', !isSelected)
      el.classList.toggle('viewport-hover-selected', isSelected)
    }
  }
}

function trackElement(id: string, el: any) {
  const dom = el?.$el ?? el
  if (!dom) return

  const parent = dom.parentElement
  if (!parent) return

  itemElements.set(id, parent)

  const isHovered = hoveredId.value === id
  const isSelected = props.selected.includes(id)
  parent.classList.toggle('viewport-hover', isHovered && !isSelected)
  parent.classList.toggle('viewport-hover-selected', isHovered && isSelected)
}

defineExpose({ hover, toggleExpand })
</script>

<template>
  <UTree
    :items="items"
    :get-key="getKey"
    selection-behaviour="manual"
    multiple
    :model-value="selectedItems"
    :expanded="expandedIds"
    @select="onSelect"
    @update:expanded="() => {}"
  >
    <template #item="{ item, expanded }">
      <div :ref="(el: any) => trackElement(keyFn(item), el)" class="w-full">
        <slot name="item" :item="item" :expanded="expanded" :toggle-expand="() => toggleExpand(keyFn(item))" />
      </div>
    </template>
  </UTree>
</template>

<style>
.viewport-hover::before {
  background-color: var(--ln-hover) !important;
}
.viewport-hover-selected::before {
  background-color: var(--ln-selection-hover) !important;
}
</style>
