<script setup lang="ts">
export type MobilePanelKind = 'tools' | 'objects' | 'tasks'

const active = defineModel<MobilePanelKind | null>('active', { required: true })

const props = defineProps<{
  hasRunningTask?: boolean
}>()

const items: { kind: MobilePanelKind; icon: string; label: string }[] = [
  { kind: 'tools', icon: 'i-lucide:wrench', label: 'Tools' },
  { kind: 'objects', icon: 'i-lucide:layers', label: 'Objects' },
  { kind: 'tasks', icon: 'i-lucide:list-checks', label: 'Tasks' },
]

function toggle(kind: MobilePanelKind) {
  active.value = active.value === kind ? null : kind
}
</script>

<template>
  <WidgetMenu class="pointer-events-auto px-1 py-1">
    <div class="flex flex-row gap-0.5 items-center">
      <button
        v-for="item in items"
        :key="item.kind"
        class="relative size-9 flex items-center justify-center rounded-md transition-colors cursor-pointer"
        :class="
          active === item.kind
            ? 'bg-[var(--ln-accent)]/20 text-[var(--ln-accent)]'
            : 'text-[var(--ln-accent)] opacity-60 hover:opacity-100'
        "
        :aria-label="item.label"
        :aria-pressed="active === item.kind"
        @click="toggle(item.kind)"
      >
        <UIcon :name="item.icon" class="size-5" />
        <UIcon
          v-if="item.kind === 'tasks' && hasRunningTask"
          name="i-lucide:loader-2"
          class="absolute -top-0.5 -right-0.5 size-3 text-[var(--ln-accent)] animate-spin"
        />
      </button>
    </div>
  </WidgetMenu>
</template>
