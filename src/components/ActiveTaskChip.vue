<script setup lang="ts">
import type { useDispatcher } from '@/composables/useDispatcher'

type Dispatcher = ReturnType<typeof useDispatcher>

const props = defineProps<{
  dispatcher: Dispatcher
}>()

const emit = defineEmits<{ open: [] }>()

const now = ref(Date.now())
let timer: number | null = null

const runningTasks = computed(() => props.dispatcher.tasks.filter((t) => t.status === 'running'))
// Show a running task if any; otherwise the most recent just-completed task
// (still in the dispatcher list during its COMPLETION_DELAY fade window).
const primary = computed(() => {
  if (runningTasks.value.length > 0) return runningTasks.value[0]!
  const tasks = props.dispatcher.tasks
  return tasks.length > 0 ? tasks[tasks.length - 1]! : null
})
const extraCount = computed(() => Math.max(0, runningTasks.value.length - 1))
const isRunning = computed(() => primary.value?.status === 'running')

const elapsed = computed(() => {
  if (!primary.value) return ''
  const endTime = isRunning.value ? now.value : primary.value.startedAt + (primary.value.durationMs ?? 0)
  const seconds = (endTime - primary.value.startedAt) / 1000
  return seconds < 10 ? `${seconds.toFixed(1)}s` : `${Math.round(seconds)}s`
})

const statusIcon = computed(() => {
  if (!primary.value) return ''
  if (primary.value.status === 'running') return 'i-lucide:loader-2'
  if (primary.value.status === 'error') return 'i-lucide:circle-x'
  return 'i-lucide:check'
})

watch(
  isRunning,
  (running) => {
    if (running && timer === null) {
      timer = window.setInterval(() => (now.value = Date.now()), 100)
    } else if (!running && timer !== null) {
      clearInterval(timer)
      timer = null
    }
  },
  { immediate: true },
)

onBeforeUnmount(() => {
  if (timer !== null) clearInterval(timer)
})
</script>

<template>
  <Transition name="bar-bottom" mode="out-in">
    <WidgetMenu v-if="primary" class="px-2 py-1 pointer-events-auto cursor-pointer" @click="emit('open')">
      <div class="flex flex-row gap-2 items-center h-7">
        <UIcon
          :name="statusIcon"
          class="size-4 shrink-0"
          :class="[
            isRunning ? 'text-[var(--ln-accent)] animate-spin' : '',
            primary.status === 'error' ? 'text-error' : '',
            primary.status === 'done' ? 'text-[var(--ln-accent)]' : '',
          ]"
        />
        <span class="text-sm truncate max-w-[10rem]">{{ primary.label }}</span>
        <span class="text-xs text-default/60 tabular-nums shrink-0">{{ elapsed }}</span>
        <span
          v-if="extraCount > 0"
          class="text-xs text-default/60 px-1.5 py-0.5 rounded-md bg-[var(--ln-accent)]/15 shrink-0"
        >
          +{{ extraCount }}
        </span>
      </div>
    </WidgetMenu>
  </Transition>
</template>
