<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { prefs } from '@/composables/usePreferences'

const emit = defineEmits<{
  dismiss: []
  download: [name: string, url: string]
  'import-files': [files: File[]]
}>()

const dontShowAgain = computed({
  get: () => prefs.skipOnboarding,
  set: (v) => {
    prefs.skipOnboarding = v
  },
})

const isTouchDevice = 'ontouchstart' in window || navigator.maxTouchPoints > 0

const dragging = ref(false)

const BASE = 'https://polydera-files.s3.eu-central-1.amazonaws.com/lunar/meshes/'

const meshes = [
  {
    name: 'Stanford Dragon',
    description: '~480k triangles. High-detail scan.',
    icon: 'i-lucide:flame',
    url: `${BASE}stanford-dragon.stl`,
  },
  {
    name: 'Stanford Bunny',
    description: '~70k triangles. The classic test mesh.',
    icon: 'i-lucide:rabbit',
    url: `${BASE}bunny.stl`,
  },
  {
    name: 'Nefertiti',
    description: '~100k triangles. Classical bust, smooth surface.',
    icon: 'i-lucide:crown',
    url: `${BASE}nefertiti.stl`,
  },
  {
    name: 'Utah Teapot',
    description: '~6k triangles. The original CG icon.',
    icon: 'i-lucide:cup-soda',
    url: `${BASE}teapot.stl`,
  },
]

function onDragOver(e: DragEvent) {
  e.preventDefault()
  dragging.value = true
}

function onDragLeave() {
  dragging.value = false
}

function onDrop(e: DragEvent) {
  e.preventDefault()
  dragging.value = false
  if (!e.dataTransfer?.files) return
  const files = Array.from(e.dataTransfer.files).filter((f) => {
    const ext = f.name.split('.').pop()?.toLowerCase()
    return ext === 'stl' || ext === 'obj'
  })
  if (files.length > 0) emit('import-files', files)
}

function openFilePicker() {
  const input = document.createElement('input')
  input.type = 'file'
  input.accept = '.stl,.obj'
  input.multiple = true
  input.onchange = () => {
    if (!input.files) return
    const files = Array.from(input.files).filter((f) => {
      const ext = f.name.split('.').pop()?.toLowerCase()
      return ext === 'stl' || ext === 'obj'
    })
    if (files.length > 0) emit('import-files', files)
  }
  input.click()
}

function onKeyDown(e: KeyboardEvent) {
  if (e.key === 'Escape') emit('dismiss')
}

onMounted(() => window.addEventListener('keydown', onKeyDown))
onUnmounted(() => window.removeEventListener('keydown', onKeyDown))
</script>

<template>
  <Teleport to="body">
    <Transition name="wizard">
      <div class="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
        <div
          class="w-full max-w-3xl mx-4 rounded-xl border border-[var(--ln-panel-border)] bg-[var(--ln-popup)] shadow-2xl overflow-hidden"
        >
          <!-- Header -->
          <div class="px-8 pt-8 pb-4 text-center">
            <div class="flex items-center justify-center gap-3 mb-2">
              <img src="/favicon.svg" class="size-10" alt="Lunar" />
              <img src="/lunar-wordmark.svg" class="h-8" alt="Lunar" />
            </div>
            <p class="text-sm text-default/50">Choose a starting point for your mesh</p>
          </div>

          <!-- Content -->
          <div class="px-8 pb-4 grid grid-cols-1 md:grid-cols-2 gap-6">
            <!-- Download -->
            <div class="flex flex-col gap-2">
              <h3 class="text-xs font-semibold uppercase tracking-wider text-default/40 mb-1">Download a Mesh</h3>
              <div
                v-for="m in meshes"
                :key="m.name"
                class="flex items-center gap-3 px-4 py-3 rounded-lg border border-[var(--ln-panel-border)] bg-[var(--ln-panel)] hover:bg-[var(--ln-hover)] cursor-pointer transition-colors"
                @click="emit('download', m.name, m.url)"
              >
                <UIcon :name="m.icon" class="size-5 text-[var(--ln-accent)] shrink-0" />
                <div class="flex-1 min-w-0">
                  <div class="text-sm font-medium">{{ m.name }}</div>
                  <div class="text-xs text-default/40 truncate">{{ m.description }}</div>
                </div>
              </div>
            </div>

            <!-- Import -->
            <div class="flex flex-col gap-2">
              <h3 class="text-xs font-semibold uppercase tracking-wider text-default/40 mb-1">Import a File</h3>

              <!-- Drop zone (desktop only) -->
              <div
                v-if="!isTouchDevice"
                class="flex-1 flex flex-col items-center justify-center gap-3 rounded-lg border-2 border-dashed transition-colors min-h-48"
                :class="
                  dragging
                    ? 'border-[var(--ln-accent)] bg-[var(--ln-accent)]/5'
                    : 'border-[var(--ln-muted)] hover:border-default/30'
                "
                @dragover="onDragOver"
                @dragleave="onDragLeave"
                @drop="onDrop"
              >
                <UIcon name="i-lucide:file-up" class="size-8 text-default/30" />
                <p class="text-sm text-default/40 text-center">
                  Drop <span class="font-medium text-default/60">STL</span> or
                  <span class="font-medium text-default/60">OBJ</span> files here
                </p>
                <UButton size="sm" variant="soft" label="Browse" icon="i-lucide:folder-open" @click="openFilePicker" />
              </div>

              <!-- Mobile: just a button -->
              <div v-else class="flex items-center justify-center py-8">
                <UButton label="Import File" icon="i-lucide:file-up" @click="openFilePicker" />
              </div>
            </div>
          </div>

          <!-- Footer -->
          <div class="px-8 py-4 flex items-center justify-between border-t border-[var(--ln-panel-border)]">
            <div class="flex items-center gap-2">
              <USwitch v-model="dontShowAgain" size="sm" />
              <span class="text-xs text-default/40">Don't show again</span>
            </div>
            <UButton variant="ghost" color="neutral" label="Dismiss" @click="emit('dismiss')" />
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
.wizard-enter-active {
  transition:
    opacity 250ms ease,
    transform 250ms ease;
}

.wizard-leave-active {
  transition:
    opacity 180ms ease,
    transform 180ms ease;
}

.wizard-enter-from {
  opacity: 0;
  transform: scale(0.96);
}

.wizard-leave-to {
  opacity: 0;
  transform: scale(0.98);
}
</style>
