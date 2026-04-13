<script setup lang="ts">
import type { useDispatcher } from '@/composables/useDispatcher'

type Dispatcher = ReturnType<typeof useDispatcher>

const props = defineProps<{
  dispatcher: Dispatcher
}>()

function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`
  return `${(ms / 1000).toFixed(2)}s`
}
</script>

<template>
  <Transition name="panel-right">
    <WidgetMenu v-if="dispatcher.tasks.length > 0" class="p-1.5 min-w-56 max-w-72 bg-[var(--ln-popup)] backdrop-blur-xl overflow-hidden">
      <div class="flex flex-col gap-1 overflow-y-auto max-h-full">
        <div
          v-for="task in dispatcher.tasks"
          :key="task.id"
          class="flex items-start gap-2.5 px-2.5 py-2 rounded-lg transition-all"
          :class="{ 'opacity-50': task.status === 'done' }"
        >
          <!-- Status icon -->
          <UIcon
            :name="
              task.status === 'running'
                ? 'i-lucide:loader-circle'
                : task.status === 'done'
                  ? 'i-lucide:circle-check'
                  : 'i-lucide:circle-x'
            "
            class="size-5 shrink-0 mt-0.5"
            :class="{
              'text-[var(--ln-accent)] animate-spin': task.status === 'running',
              'text-[var(--ln-accent)]': task.status === 'done',
              'text-red-400': task.status === 'error',
            }"
          />

          <!-- Content -->
          <div class="flex flex-col flex-1 min-w-0 gap-0.5">
            <div class="flex items-center gap-1.5">
              <span class="text-sm font-medium truncate text-default">{{ task.label }}</span>
              <span
                v-if="task.durationMs !== undefined"
                class="text-[10px] font-mono shrink-0 px-1.5 py-0.5 rounded-full bg-[var(--ln-active)] text-[var(--ln-accent)]"
              >
                {{ formatDuration(task.durationMs) }}
              </span>
            </div>
            <div class="flex items-center gap-1.5">
              <span class="size-4 shrink-0 rounded flex items-center justify-center bg-[var(--ln-active)]">
                <UIcon
                  :name="task.origin === 'mcp' ? 'i-lucide:bot' : 'i-lucide:mouse-pointer'"
                  class="size-2.5 text-[var(--ln-accent)]"
                />
              </span>
              <span v-if="task.source && !task.error" class="text-xs text-default/50 truncate">{{ task.source }}</span>
              <span v-if="task.error" class="text-xs text-red-400 truncate">{{ task.error }}</span>
            </div>
          </div>

          <!-- Dismiss error -->
          <UButton
            v-if="task.status === 'error'"
            icon="i-lucide:x"
            variant="ghost"
            color="neutral"
            size="xs"
            class="shrink-0 mt-0.5"
            @click="dispatcher.removeTask(task.id)"
          />
        </div>
      </div>
    </WidgetMenu>
  </Transition>
</template>
