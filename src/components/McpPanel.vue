<script setup lang="ts">
import { ref, computed } from 'vue'
import Separator from './Separator.vue'

const props = defineProps<{
  sessionId: string
  connected: boolean
  mcpUrl: string
}>()

const emit = defineEmits<{
  reset: []
  connect: []
  disconnect: []
}>()

const copied = ref(false)

async function copyUrl() {
  await navigator.clipboard.writeText(props.mcpUrl)
  copied.value = true
  setTimeout(() => (copied.value = false), 2000)
}

async function copyText(text: string) {
  await navigator.clipboard.writeText(text)
}

const claudeConfig = computed(() =>
  JSON.stringify(
    {
      mcpServers: {
        lunar: {
          command: 'npx',
          args: ['mcp-remote', props.mcpUrl],
        },
      },
    },
    null,
    2,
  ),
)

const geminiCmd = computed(() => `gemini mcp add lunar ${props.mcpUrl} -t http`)

const codexCmd = computed(() => `codex mcp add lunar -- npx mcp-remote ${props.mcpUrl}`)
</script>

<template>
  <div class="flex flex-col gap-4 px-4 py-3">
    <!-- Status -->
    <section class="flex flex-col gap-2">
      <h3 class="uppercase tracking-wider text-[10px] font-bold text-[var(--ln-accent)]">Connection</h3>
      <div class="flex items-center justify-between">
        <div class="flex items-center gap-2">
          <span class="size-2 rounded-full shrink-0" :class="connected ? 'bg-emerald-400' : 'bg-default/30'" />
          <span class="text-sm text-default/70">
            {{ connected ? 'Connected' : 'Disconnected' }}
          </span>
        </div>
        <USwitch :model-value="connected" @update:model-value="$event ? emit('connect') : emit('disconnect')" />
      </div>
      <div class="flex items-center gap-2">
        <input
          :value="mcpUrl"
          readonly
          class="flex-1 bg-[var(--ln-muted)] text-xs text-default/60 font-mono rounded px-2.5 py-1.5 outline-none select-all"
          @focus="($event.target as HTMLInputElement).select()"
        />
        <UButton
          :icon="copied ? 'i-lucide:check' : 'i-lucide:copy'"
          :color="copied ? 'primary' : 'neutral'"
          variant="ghost"
          size="xs"
          @click="copyUrl"
        />
      </div>
      <p class="text-[10px] text-default/30">Session persists across refreshes. Reset to get a new URL.</p>
      <div class="flex items-center justify-between">
        <span class="text-[10px] text-default/30 font-mono">{{ sessionId }}</span>
        <UButton
          label="New session"
          icon="i-lucide:refresh-cw"
          color="neutral"
          variant="ghost"
          size="xs"
          @click="emit('reset')"
        />
      </div>
    </section>

    <Separator />

    <!-- Claude Code -->
    <section class="flex flex-col gap-2">
      <h3 class="uppercase tracking-wider text-[10px] font-bold text-[var(--ln-accent)]">Claude Code</h3>
      <p class="text-xs text-default/50">Add to <code class="text-default/70">.claude/settings.json</code>:</p>
      <div class="flex items-start gap-1">
        <pre class="flex-1 bg-[var(--ln-muted)] rounded px-3 py-2 text-[11px] font-mono text-default/70 overflow-x-auto">{{
          claudeConfig
        }}</pre>
        <UButton
          icon="i-lucide:copy"
          color="neutral"
          variant="ghost"
          size="xs"
          class="shrink-0 mt-1"
          @click="copyText(claudeConfig)"
        />
      </div>
    </section>

    <Separator />

    <!-- Gemini CLI -->
    <section class="flex flex-col gap-2">
      <h3 class="uppercase tracking-wider text-[10px] font-bold text-[var(--ln-accent)]">Gemini CLI</h3>
      <div class="flex items-start gap-1">
        <pre class="flex-1 bg-[var(--ln-muted)] rounded px-3 py-2 text-[11px] font-mono text-default/70 overflow-x-auto">{{
          geminiCmd
        }}</pre>
        <UButton
          icon="i-lucide:copy"
          color="neutral"
          variant="ghost"
          size="xs"
          class="shrink-0 mt-1"
          @click="copyText(geminiCmd)"
        />
      </div>
    </section>

    <Separator />

    <!-- OpenAI Codex -->
    <section class="flex flex-col gap-2">
      <h3 class="uppercase tracking-wider text-[10px] font-bold text-[var(--ln-accent)]">OpenAI Codex CLI</h3>
      <div class="flex items-start gap-1">
        <pre class="flex-1 bg-[var(--ln-muted)] rounded px-3 py-2 text-[11px] font-mono text-default/70 overflow-x-auto">{{
          codexCmd
        }}</pre>
        <UButton
          icon="i-lucide:copy"
          color="neutral"
          variant="ghost"
          size="xs"
          class="shrink-0 mt-1"
          @click="copyText(codexCmd)"
        />
      </div>
    </section>
  </div>
</template>
