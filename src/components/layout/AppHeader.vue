<script setup lang="ts">
import type { useActions } from '@/composables/useActions'
import type { useMCP } from '@/mcp/useMCP'

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
</script>

<template>
  <WidgetMenu class="px-4 py-3 pointer-events-auto shrink-0">
    <div class="flex flex-row gap-3 items-center">
      <img src="/favicon.svg" class="size-8" alt="Lunar" />
      <h1 class="flex items-center">
        <span class="sr-only">Lunar</span>
        <img src="/lunar-wordmark.svg" class="h-6" alt="" aria-hidden="true" />
      </h1>
      <Separator direction="vertical" class="ml-auto" />
      <div class="flex flex-row gap-2 items-center">
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
      <Separator direction="vertical" />
      <div class="flex flex-row gap-2 items-center">
        <button
          class="text-[var(--ln-accent)] opacity-60 hover:opacity-100 transition-opacity cursor-pointer"
          @click="actions.runAction('open-settings')"
        >
          <UIcon name="i-lucide:settings" class="size-6" />
        </button>
        <button
          class="text-[var(--ln-accent)] opacity-60 hover:opacity-100 transition-opacity cursor-pointer"
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
