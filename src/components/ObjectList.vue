<script setup lang="ts">
import type { MeshObject } from '@/utils/tree'
import type { useScene } from '@/scene/useScene'
import type { DropdownMenuItem } from '@nuxt/ui'
import EnhancedTree from '@/components/EnhancedTree.vue'

type Scene = ReturnType<typeof useScene>

const props = defineProps<{
  scene: Scene
}>()

const open = ref(true)
const treeRef = ref<InstanceType<typeof EnhancedTree> | null>(null)

const customSlotItemUi = {
  item: 'data-highlighted:text-default data-highlighted:before:bg-transparent',
  itemLeadingIcon: 'group-data-highlighted:text-dimmed',
} as DropdownMenuItem['ui']

const dropdownOptions: DropdownMenuItem[][] = [
  [
    {
      label: 'Opacity',
      value: 'opacity',
      icon: 'i-hugeicons:transparency',
      slot: 'slider' as const,
      onSelect: (e: Event) => e.preventDefault(),
      ui: customSlotItemUi,
    },
  ],
  [
    {
      label: 'Export to STL',
      icon: 'i-hugeicons:file-export',
      value: 'export-stl',
    },
    {
      label: 'Export to OBJ',
      icon: 'i-hugeicons:file-export',
      value: 'export-obj',
    },
  ],
]

const expandedStates = ref<Record<string, boolean>>({})

const getObjectKey = (item: any) => item.value ?? ''

const toggleObjectVisibility = (event: MouseEvent, value: string) => {
  event.preventDefault()
  event.stopPropagation()
  props.scene.toggleVisible(value)
}

const onColorChange = (id: string | undefined, color: string | undefined) => {
  if (id && color) props.scene.setColor(id, color)
}

const onOpacityChange = (id: string | undefined, opacity: number) => {
  if (id) props.scene.setOpacity(id, opacity)
}

const getVisibilityIcon = (item: any) => {
  if (item.isVisible === 'indeterminate') return 'i-hugeicons:minus-sign'
  return item.isVisible ? 'i-hugeicons:view' : 'i-hugeicons:view-off-slash'
}

const getTransitionDirection = (itemValue: string, expanded: boolean): 'expand' | 'collapse' => {
  const wasExpanded = expandedStates.value[itemValue] ?? false
  expandedStates.value[itemValue] = expanded
  return expanded && !wasExpanded ? 'expand' : 'collapse'
}

function onSelectionChange(ids: string[]) {
  props.scene.clearSelection()
  for (const id of ids) {
    props.scene.select(id, true)
  }
}

// ── Inline rename ────────────────────────────────────────

const editingId = ref<string | null>(null)
const editingLabel = ref('')

function startRename(id: string | undefined, currentLabel: string | undefined) {
  if (!id || !currentLabel) return
  editingId.value = id
  editingLabel.value = currentLabel
  nextTick(() => {
    const input = document.querySelector(`[data-rename="${id}"]`) as HTMLInputElement | null
    input?.focus()
    input?.select()
  })
}

function commitRename() {
  if (editingId.value && editingLabel.value.trim()) {
    props.scene.setLabel(editingId.value, editingLabel.value.trim())
  }
  editingId.value = null
}

function cancelRename() {
  editingId.value = null
}

// Expose tree ref so viewport can call hover
defineExpose({ tree: treeRef })

// Watch hoveredNode and selection changes, forward to tree
watch(
  () => props.scene.hoveredNode.value,
  (id) => treeRef.value?.hover(id),
)
watch(
  () => props.scene.activeSelection.length,
  () => nextTick(() => treeRef.value?.hover(props.scene.hoveredNode.value)),
)
</script>

<template>
  <WidgetMenu>
    <UCollapsible :unmount-on-hide="false" v-model:open="open" class="flex flex-col gap-1">
      <div class="flex flex-row gap-3 justify-between items-center rounded-md px-2 py-1 cursor-pointer">
        <h3 class="uppercase text-base font-bold select-none">Objects</h3>
        <UIcon
          name="i-hugeicons:arrow-up-01"
          class="size-6 cursor-pointer transition-transform duration-300 ease-in-out"
          :class="{ 'rotate-0': open, 'rotate-180': !open }"
        />
      </div>
      <template #content>
        <div class="flex flex-col gap-1 p-1 w-xs">
          <EnhancedTree
            ref="treeRef"
            :items="scene.tree.value"
            :get-key="getObjectKey"
            :selected="[...scene.activeSelection]"
            @update:selected="onSelectionChange"
          >
            <template #item="{ item, expanded, toggleExpand }">
              <div class="w-full flex flex-row gap-2 items-center justify-between min-w-0">
                <div class="flex flex-row gap-2 items-center justify-start min-w-0 flex-1">
                  <div
                    v-if="item.isVisual || (item.children && item.children.length > 0)"
                    class="relative size-5 shrink-0 cursor-pointer"
                    @click="toggleObjectVisibility($event, item.value)"
                  >
                    <Transition name="icon-fade" mode="out-in">
                      <UIcon :key="String(item.isVisible)" :name="getVisibilityIcon(item)" class="size-5 absolute inset-0" />
                    </Transition>
                  </div>
                  <input
                    v-if="editingId === item.value"
                    :data-rename="item.value"
                    v-model="editingLabel"
                    class="text-sm bg-transparent outline-none border-b border-[var(--ln-accent)] w-full"
                    @keydown.enter="commitRename"
                    @keydown.escape="cancelRename"
                    @keydown.stop
                    @blur="commitRename"
                    @click.stop
                  />
                  <div
                    v-else
                    class="text-sm truncate min-w-0"
                    :class="{ 'text-dimmed transition-colors': item.isVisible === false }"
                    @dblclick.stop="startRename(item.value, item.label)"
                  >
                    {{ item.label }}
                  </div>
                </div>
                <div class="flex flex-row gap-1 items-center justify-end shrink-0">
                  <UPopover :ui="{ content: 'bg-default/30 backdrop-blur' }">
                    <div
                      v-if="item.isVisual && item.color"
                      class="size-4 rounded-[0.35rem] cursor-pointer"
                      :style="{ backgroundColor: item.color }"
                      @click.stop
                    />
                    <template #content>
                      <div class="p-2">
                        <UColorPicker :model-value="item.color" @update:model-value="onColorChange(item.value!, $event)" />
                      </div>
                    </template>
                  </UPopover>

                  <div
                    v-if="item.children && item.children.length > 0"
                    class="relative size-5 cursor-pointer"
                    @click.stop="toggleExpand"
                  >
                    <Transition
                      :name="getTransitionDirection(item.value, expanded) === 'expand' ? 'icon-spin-ccw' : 'icon-spin-cw'"
                    >
                      <UIcon
                        :key="expanded ? 'up' : 'down'"
                        :name="expanded ? 'i-hugeicons:arrow-up-01' : 'i-hugeicons:arrow-down-01'"
                        class="size-5 absolute inset-0"
                      />
                    </Transition>
                  </div>

                  <UDropdownMenu v-if="item.isVisual" :items="dropdownOptions" :ui="{ content: 'w-56' }">
                    <UIcon name="i-hugeicons:more-vertical" class="size-5 cursor-pointer" @click.stop />
                    <template #slider="{ item: sliderItem }: { item: { label: string; value: string; icon?: string } }">
                      <div class="flex flex-col gap-2 w-full items-start">
                        <div class="flex flex-row gap-1.5 items-center justify-start">
                          <UIcon v-if="sliderItem.icon" :name="sliderItem.icon" class="size-5" />
                          <div class="text-sm font-medium">{{ sliderItem.label }}</div>
                        </div>
                        <div class="flex flex-row gap-2 items-center justify-between w-full">
                          <USlider
                            :model-value="item.opacity ?? 100"
                            @update:model-value="onOpacityChange(item.value, $event)"
                            :min="0"
                            :max="100"
                          />
                          <div class="text-xs text-default/70">{{ item.opacity ?? 100 }}%</div>
                        </div>
                      </div>
                    </template>
                  </UDropdownMenu>
                </div>
              </div>
            </template>
          </EnhancedTree>
        </div>
      </template>
    </UCollapsible>
  </WidgetMenu>
</template>
