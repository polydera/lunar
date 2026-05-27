<script setup lang="ts">
import type { useActions } from '@/composables/useActions'
import type { useMCP } from '@/mcp/useMCP'
import type { DropdownMenuItem } from '@nuxt/ui'

type Actions = ReturnType<typeof useActions>
type MCPHandle = ReturnType<typeof useMCP>

const HelpPanel = defineAsyncComponent(() => import('@/components/HelpPanel.vue'))
const McpPanel = defineAsyncComponent(() => import('@/components/McpPanel.vue'))
const SettingsPanel = defineAsyncComponent(() => import('@/components/SettingsPanel.vue'))

const props = defineProps<{
  actions: Actions
  mcpHandle: MCPHandle | null
}>()

const showSettings = defineModel<boolean>('showSettings', { required: true })
const showHelp = defineModel<boolean>('showHelp', { required: true })
const showMcp = defineModel<boolean>('showMcp', { required: true })
const showCommand = defineModel<boolean>('showCommand', { required: true })

const overflowItems: DropdownMenuItem[][] = [
  [
    { label: 'Settings', icon: 'i-lucide:settings', onSelect: () => (showSettings.value = true) },
    { label: 'Help', icon: 'i-lucide:circle-help', onSelect: () => (showHelp.value = true) },
    { label: 'AI / MCP', icon: 'i-lucide:bot', onSelect: () => (showMcp.value = true) },
  ],
  [
    { label: 'GitHub', icon: 'i-simple-icons:github', to: 'https://github.com/polydera/lunar', target: '_blank' },
    { label: 'polydera.com', icon: 'i-lucide:globe', to: 'https://polydera.com', target: '_blank' },
  ],
]
</script>

<template>
  <WidgetMenu class="px-1 py-1 roomy:px-4 roomy:py-3 pointer-events-auto shrink-0">
    <div class="flex flex-row gap-1 roomy:gap-3 items-center">
      <div class="size-chip-btn roomy:size-auto flex items-center justify-center">
        <img src="/favicon.svg" class="size-7 roomy:size-8" alt="Lunar" />
      </div>
      <h1 class="hidden roomy:flex items-center">
        <span class="sr-only">Lunar</span>
        <img src="/lunar-wordmark.svg" class="h-6" alt="" aria-hidden="true" />
      </h1>

      <Separator direction="vertical" class="hidden roomy:block ml-auto" />

      <!-- External links: desktop only -->
      <div class="hidden roomy:flex flex-row gap-2 items-center">
        <a
          href="https://github.com/polydera/lunar"
          target="_blank"
          rel="noopener"
          class="text-[var(--ln-accent)] opacity-60 hover:opacity-100 transition-opacity"
        >
          <UIcon name="i-simple-icons:github" class="size-6" />
        </a>
        <a
          href="https://polydera.com"
          target="_blank"
          rel="noopener"
          class="text-[var(--ln-accent)] opacity-60 hover:opacity-100 transition-opacity"
        >
          <UIcon name="i-lucide:globe" class="size-6" />
        </a>
      </div>
      <Separator direction="vertical" class="hidden roomy:block" />

      <!-- Mobile-only: Search button (command palette) -->
      <button
        class="roomy:hidden size-chip-btn flex items-center justify-center rounded-md text-[var(--ln-accent)] opacity-60 hover:opacity-100 transition-opacity cursor-pointer"
        aria-label="Search commands"
        @click="showCommand = true"
      >
        <UIcon name="i-lucide:search" class="size-chip-icon" />
      </button>

      <!-- Mobile-only: Overflow menu (Settings, Help, MCP, links) -->
      <UDropdownMenu
        :items="overflowItems"
        :ui="{ content: 'w-56 bg-[var(--ln-popup)] backdrop-blur-xl' }"
        class="roomy:hidden"
      >
        <button
          class="relative size-chip-btn flex items-center justify-center rounded-md text-[var(--ln-accent)] opacity-60 hover:opacity-100 transition-opacity cursor-pointer"
          aria-label="More"
        >
          <UIcon name="i-lucide:more-vertical" class="size-chip-icon" />
          <!-- Connection dot so MCP status is visible without opening the menu -->
          <span
            v-if="mcpHandle?.connected.value"
            class="absolute top-1 right-1 size-2 rounded-full bg-[var(--ln-accent)]"
          />
        </button>
      </UDropdownMenu>

      <!-- Desktop-only: full action group -->
      <div class="hidden roomy:flex flex-row gap-2 items-center">
        <button
          class="text-[var(--ln-accent)] opacity-60 hover:opacity-100 transition-opacity cursor-pointer p-1"
          aria-label="Settings"
          @click="actions.runAction('open-settings')"
        >
          <UIcon name="i-lucide:settings" class="size-6" />
        </button>
        <button
          class="text-[var(--ln-accent)] opacity-60 hover:opacity-100 transition-opacity cursor-pointer p-1"
          aria-label="Help"
          @click="actions.runAction('open-help')"
        >
          <UIcon name="i-lucide:circle-help" class="size-6" />
        </button>
        <button
          class="rounded-md p-1 transition-all cursor-pointer"
          :class="
            mcpHandle?.connected.value
              ? 'bg-primary/20 text-[var(--ln-accent)]'
              : 'text-[var(--ln-accent)] opacity-60 hover:opacity-100'
          "
          aria-label="MCP / AI"
          @click="showMcp = true"
        >
          <UIcon name="i-lucide:bot" class="size-5" />
        </button>
      </div>
    </div>
  </WidgetMenu>

  <!-- Settings modal -->
  <UModal
    v-model:open="showSettings"
    title="Settings"
    description="Application preferences"
    :ui="{ content: 'bg-[var(--ln-popup)] sm:max-w-md' }"
  >
    <template #body>
      <SettingsPanel />
    </template>
  </UModal>

  <!-- Help modal -->
  <UModal
    v-model:open="showHelp"
    title="Help"
    description="Keyboard shortcuts and guide"
    :ui="{ content: 'bg-[var(--ln-popup)] sm:max-w-2xl' }"
  >
    <template #body>
      <HelpPanel />
    </template>
  </UModal>

  <!-- MCP modal -->
  <UModal
    v-model:open="showMcp"
    title="AI Integration"
    description="Connect AI assistants to Lunar via MCP"
    :ui="{ content: 'bg-[var(--ln-popup)] sm:max-w-lg' }"
  >
    <template #body>
      <McpPanel
        v-if="mcpHandle"
        :session-id="mcpHandle.sessionId.value"
        :connected="mcpHandle.connected.value"
        :mcp-url="mcpHandle.getMcpUrl()"
        @reset="mcpHandle.resetSession()"
        @connect="mcpHandle.connect()"
        @disconnect="mcpHandle.dispose()"
      />
    </template>
  </UModal>
</template>
