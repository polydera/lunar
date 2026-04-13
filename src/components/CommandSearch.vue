<script setup lang="ts">
import type { CommandPaletteGroup, CommandPaletteItem } from '@nuxt/ui'
import type { Category } from '@/setup/categories'
import type { DrillIn } from './ContextPanel.vue'

const props = defineProps<{
  categories: Category[]
}>()

const activeDrillIn = defineModel<DrillIn | null>('drillIn', { default: null })
const open = defineModel<boolean>('open', { default: false })
const runAction = inject<(id: string) => void>('runAction')

interface PaletteItem extends CommandPaletteItem {
  _kind: 'action' | 'operator' | 'sceneOperator'
  _id: string
  _tags?: string[]
}

const groups = computed<CommandPaletteGroup<PaletteItem>[]>(() => {
  const result: CommandPaletteGroup<PaletteItem>[] = []

  for (const cat of props.categories) {
    const items: PaletteItem[] = []
    for (const item of cat.items) {
      if (item.type === 'action') {
        // Actions with drill-ins (like download) set activeDrillIn; others run directly
        const hasDrillIn = item.id === 'io-download'
        items.push({
          label: item.label,
          icon: item.icon ?? cat.icon,
          description: item.description,
          _kind: 'action',
          _id: item.id,
          onSelect: hasDrillIn
            ? () => {
                activeDrillIn.value = { type: 'action', id: item.id }
              }
            : () => runAction?.(item.id),
        })
      } else if (item.type === 'operator') {
        const op = item.operator
        items.push({
          label: op.label,
          icon: cat.icon,
          description: op.description,
          _kind: 'operator',
          _id: op.id,
          _tags: op.tags,
          onSelect: () => {
            activeDrillIn.value = { type: 'operator', operator: op }
          },
        })
      } else if (item.type === 'sceneOperator') {
        const so = item.sceneOperator
        items.push({
          label: so.label,
          icon: cat.icon,
          description: so.description,
          _kind: 'sceneOperator',
          _id: so.id,
          _tags: so.tags,
          onSelect: () => {
            activeDrillIn.value = { type: 'sceneOperator', sceneOperator: so }
          },
        })
      }
    }
    if (items.length === 0) continue
    result.push({ id: cat.id, label: cat.label, items })
  }

  const appItems: PaletteItem[] = [
    {
      label: 'Settings',
      icon: 'i-lucide:settings',
      description: 'Application preferences',
      _kind: 'action',
      _id: 'open-settings',
      onSelect: () => runAction?.('open-settings'),
    },
    {
      label: 'Help',
      icon: 'i-lucide:circle-help',
      description: 'Keyboard shortcuts and guide',
      _kind: 'action',
      _id: 'open-help',
      onSelect: () => runAction?.('open-help'),
    },
    {
      label: 'GitHub',
      icon: 'i-simple-icons:github',
      description: 'Open the Lunar repository',
      _kind: 'action',
      _id: 'open-github',
      onSelect: () => window.open('https://github.com/polydera/lunar', '_blank', 'noopener'),
    },
    {
      label: 'Website',
      icon: 'i-lucide:globe',
      description: 'Open polydera.com',
      _kind: 'action',
      _id: 'open-website',
      onSelect: () => window.open('https://polydera.com', '_blank', 'noopener'),
    },
  ]
  result.push({ id: 'app', label: 'App', items: appItems })

  return result
})

const fuseConfig = {
  fuseOptions: {
    ignoreLocation: false,
    threshold: 0.2,
    keys: [
      { name: 'label', weight: 2 },
      { name: 'description', weight: 0.2 },
      { name: '_tags', weight: 0.15 },
    ],
  },
}
</script>

<template>
  <UDashboardSearch
    v-model:open="open"
    shortcut="meta_k"
    :groups="groups as any"
    :overlay="false"
    :content="{ class: 'bg-[var(--ln-popup)]' } as any"
    :fuse="fuseConfig"
    :ui="{
      input: 'placeholder:text-highlighted',
    }"
  />
</template>
