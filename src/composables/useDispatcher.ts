import { reactive } from 'vue'

export interface Task {
  id: string
  label: string
  source?: string
  origin?: 'user' | 'mcp'
  status: 'running' | 'done' | 'error'
  startedAt: number
  durationMs?: number
  error?: string
}

const COMPLETION_DELAY = 7000
const MAX_TASKS = 10

export function useDispatcher() {
  const tasks = reactive<Task[]>([])
  let nextId = 0

  function updateTask(id: string, patch: Partial<Task>) {
    const i = tasks.findIndex((t) => t.id === id)
    if (i !== -1) tasks[i] = { ...tasks[i]!, ...patch }
  }

  function dispatch<T>(
    label: string,
    source: string | undefined,
    fn: () => Promise<T>,
    origin?: 'user' | 'mcp',
  ): Promise<T> {
    const id = `task-${nextId++}`
    const startedAt = Date.now()
    tasks.push({
      id,
      label,
      source,
      origin,
      status: 'running',
      startedAt,
    })

    // FIFO: drop oldest done/error tasks if over the limit
    while (tasks.length > MAX_TASKS) {
      const oldestDoneIdx = tasks.findIndex((t) => t.status !== 'running')
      if (oldestDoneIdx === -1) break
      tasks.splice(oldestDoneIdx, 1)
    }

    return fn()
      .then((result) => {
        updateTask(id, { status: 'done', durationMs: Date.now() - startedAt })
        setTimeout(() => removeTask(id), COMPLETION_DELAY)
        return result
      })
      .catch((e) => {
        updateTask(id, {
          status: 'error',
          durationMs: Date.now() - startedAt,
          error: String((e as { message?: unknown })?.message ?? e),
        })
        throw e
      })
  }

  function removeTask(id: string) {
    const i = tasks.findIndex((t) => t.id === id)
    if (i !== -1) tasks.splice(i, 1)
  }

  return { tasks, dispatch, removeTask }
}
