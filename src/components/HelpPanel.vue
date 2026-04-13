<script setup lang="ts">
import Separator from './Separator.vue'

const isMac = navigator.platform.startsWith('Mac')

interface ModeRow {
  icon: string
  label: string
  kbd?: string
  description: string
}

const modes: ModeRow[] = [
  {
    icon: 'i-hugeicons:move',
    label: 'Normal',
    description:
      'Click a mesh to select, click empty space to clear. Drag a selected mesh to translate the selection in the view plane; drag a non-selected mesh to translate just that mesh. Drag empty space to orbit the camera around the scene center. Shift+drag empty space to pan.',
  },
  {
    icon: 'i-hugeicons:rotate-clockwise',
    label: 'Transform',
    kbd: 'T',
    description:
      "Drag a selected mesh to rotate the selection around that mesh's center; drag a non-selected mesh to rotate just that mesh. Drag empty space to rotate the selection around the world point under the cursor (requires a selection). Scroll to scale each mesh around its own center.",
  },
  {
    icon: 'i-hugeicons:orbit-01',
    label: 'Camera',
    kbd: 'C',
    description:
      "Drag to orbit the camera. On a mesh, the pivot is that mesh's center; on empty space, the pivot is the world point under the cursor.",
  },
  {
    icon: 'i-hugeicons:add-circle',
    label: 'Append',
    kbd: 'Ctrl',
    description: 'Click a mesh to add it to the selection; click a selected mesh to remove it.',
  },
]

interface ModifierRow {
  icon: string
  label: string
  description: string
}

const modifiers: ModifierRow[] = [
  {
    icon: 'i-lucide:axis-3d',
    label: 'Axis lock',
    description:
      'Shift+click an axis on the bottom-left widget to constrain rotation, scale, and translation to that axis. Shift+click again to unlock.',
  },
  {
    icon: 'i-lucide:move',
    label: 'Pan',
    description: 'Right-click drag or Shift+drag on empty space to pan the camera.',
  },
]

interface KeyRow {
  kbd: string
  label: string
}

const keyRows: KeyRow[] = [
  { kbd: 'Click', label: 'Select' },
  { kbd: 'Shift+Click', label: 'Range select' },
  { kbd: isMac ? '⌘+Click' : 'Ctrl+Click', label: 'Toggle in selection' },
  { kbd: 'Drag', label: 'Move, rotate, or orbit (mode-dependent)' },
  { kbd: 'Right Drag', label: 'Pan camera' },
  { kbd: 'Shift+Drag', label: 'Pan camera (alternative)' },
  { kbd: 'Scroll', label: 'Zoom toward cursor, or scale (mode-dependent)' },
  { kbd: 'Shift+T', label: 'Lock Transform mode' },
  { kbd: 'Shift+C', label: 'Lock Camera mode' },
  { kbd: 'N', label: 'Return to Normal mode' },
  { kbd: 'Delete', label: 'Delete selection' },
  { kbd: 'F', label: 'Focus selection (or fit scene)' },
  { kbd: isMac ? '⌘ K' : 'Ctrl + K', label: 'Command palette' },
  { kbd: 'Escape', label: 'Close / back / unlock mode' },
]

const tips = [
  'Drag and drop STL or OBJ files onto the viewport to import.',
  'Run Inspect → Curvature, then Style → Color by Array to visualize per-vertex data on the mesh surface.',
  'The axes widget (bottom-left) shows camera orientation. Positive dots are filled, negative dots are hollow.',
  `Press ${isMac ? '⌘ K' : 'Ctrl + K'} to find any operator, action, or link by name.`,
]

const version = '0.8.7'
</script>

<template>
  <div class="flex flex-col gap-4 px-4 py-3">
    <!-- About -->
    <section class="flex flex-col gap-1.5">
      <h3 class="uppercase tracking-wider text-[10px] font-bold text-[var(--ln-accent)]">About</h3>
      <p class="text-sm text-default/80 leading-relaxed">
        Lunar is a UI frontend for
        <a
          href="https://trueform.polydera.com"
          target="_blank"
          rel="noopener"
          class="text-[var(--ln-accent)] hover:underline"
          >trueform</a
        >
        — a real-time geometric processing library for arrangements, booleans, registration, remeshing, and mesh queries.
        Every operator maps to a function in
        <a
          href="https://trueform.polydera.com/ts/getting-started"
          target="_blank"
          rel="noopener"
          class="text-[var(--ln-accent)] hover:underline inline-flex items-center gap-1 align-baseline"
          >trueform <UIcon name="i-simple-icons:typescript" class="size-3.5" /></a
        >. Native via WebAssembly. Parallel via async tasks.
      </p>
      <p class="text-sm text-default/60 leading-relaxed">
        Press
        <kbd
          class="px-1.5 py-0.5 rounded text-[10px] leading-none text-[var(--ln-accent)] border border-[var(--ln-accent)]/40"
          >{{ isMac ? '⌘ K' : 'Ctrl + K' }}</kbd
        >
        to quickly find any operator or action.
      </p>
      <p class="text-sm text-default/60 leading-relaxed">
        Connect any AI assistant (Claude, Gemini, Codex) to control Lunar via MCP. Click
        <UIcon name="i-lucide:bot" class="size-3.5 inline-block text-[var(--ln-accent)] align-text-bottom" /> in the header
        for setup.
      </p>
    </section>

    <Separator />

    <!-- Interaction model -->
    <section class="flex flex-col gap-1.5">
      <h3 class="uppercase tracking-wider text-[10px] font-bold text-[var(--ln-accent)]">Select first, then act</h3>
      <p class="text-sm text-default/80 leading-relaxed">
        Click a mesh in the viewport or the Objects list to select it. {{ isMac ? '⌘' : 'Ctrl' }}-click to extend the
        selection. Open a category (Inspect, Cut, Refine, Style, …) or press
        <kbd
          class="px-1.5 py-0.5 rounded text-[10px] leading-none text-[var(--ln-accent)] border border-[var(--ln-accent)]/40"
          >{{ isMac ? '⌘ K' : 'Ctrl + K' }}</kbd
        >
        to run any operator on the selection.
      </p>
      <p class="text-sm text-default/80 leading-relaxed mt-1">
        Operators read the selection in three ways. Single-input operators run on each selected mesh in parallel. Multi-input
        operators consume meshes in selection order. Array operators take the whole selection as one set.
      </p>
    </section>

    <Separator />

    <!-- Interaction modes -->
    <section class="flex flex-col gap-2">
      <h3 class="uppercase tracking-wider text-[10px] font-bold text-[var(--ln-accent)]">Interaction modes</h3>
      <div class="flex flex-col gap-2">
        <div v-for="m in modes" :key="m.label" class="flex items-start gap-3 px-1">
          <UIcon :name="m.icon" class="size-5 shrink-0 mt-0.5 text-[var(--ln-accent)] opacity-60" />
          <div class="flex flex-col gap-0.5 flex-1 min-w-0">
            <div class="flex items-center gap-2">
              <span class="text-sm font-semibold">{{ m.label }}</span>
              <kbd
                v-if="m.kbd"
                class="px-1.5 py-0.5 rounded text-[10px] leading-none text-[var(--ln-accent)] border border-[var(--ln-accent)]/40"
                >{{ m.kbd }}</kbd
              >
            </div>
            <p class="text-xs text-default/70 leading-relaxed">{{ m.description }}</p>
          </div>
        </div>
      </div>
      <p class="text-[10px] text-default/40 px-1 mt-1">Hold key for momentary. Shift+key to lock. N or Escape to release.</p>
    </section>

    <Separator />

    <!-- Modifiers (stack with any mode) -->
    <section class="flex flex-col gap-2">
      <h3 class="uppercase tracking-wider text-[10px] font-bold text-[var(--ln-accent)]">Modifiers</h3>
      <div class="flex flex-col gap-2">
        <div v-for="m in modifiers" :key="m.label" class="flex items-start gap-3 px-1">
          <UIcon :name="m.icon" class="size-5 shrink-0 mt-0.5 text-[var(--ln-accent)] opacity-60" />
          <div class="flex flex-col gap-0.5 flex-1 min-w-0">
            <span class="text-sm font-semibold">{{ m.label }}</span>
            <p class="text-xs text-default/70 leading-relaxed">{{ m.description }}</p>
          </div>
        </div>
      </div>
      <p class="text-[10px] text-default/40 px-1 mt-1">Modifiers stack with any mode. N or Escape clears all.</p>
    </section>

    <Separator />

    <!-- Keyboard reference -->
    <section class="flex flex-col gap-2">
      <h3 class="uppercase tracking-wider text-[10px] font-bold text-[var(--ln-accent)]">Keyboard</h3>
      <div class="grid grid-cols-2 gap-x-6 gap-y-1.5 text-sm">
        <div v-for="k in keyRows" :key="k.kbd" class="flex items-center gap-3 min-w-0">
          <kbd
            class="shrink-0 px-1.5 py-0.5 rounded text-[10px] leading-none text-[var(--ln-accent)] border border-[var(--ln-accent)]/40 font-mono"
            >{{ k.kbd }}</kbd
          >
          <span class="text-default/80 truncate">{{ k.label }}</span>
        </div>
      </div>
    </section>

    <Separator />

    <!-- Axes widget -->
    <section class="flex flex-col gap-2">
      <h3 class="uppercase tracking-wider text-[10px] font-bold text-[var(--ln-accent)]">Axes Widget</h3>
      <div class="grid grid-cols-2 gap-x-6 gap-y-1.5 text-sm">
        <div class="flex items-center gap-3 min-w-0">
          <kbd
            class="shrink-0 px-1.5 py-0.5 rounded text-[10px] leading-none text-[var(--ln-accent)] border border-[var(--ln-accent)]/40 font-mono"
            >Click</kbd
          >
          <span class="text-default/80 truncate">Rotate 90° around axis</span>
        </div>
        <div class="flex items-center gap-3 min-w-0">
          <kbd
            class="shrink-0 px-1.5 py-0.5 rounded text-[10px] leading-none text-[var(--ln-accent)] border border-[var(--ln-accent)]/40 font-mono"
            >{{ isMac ? '⌥+Click' : 'Alt+Click' }}</kbd
          >
          <span class="text-default/80 truncate">Snap to axis view</span>
        </div>
        <div class="flex items-center gap-3 min-w-0">
          <kbd
            class="shrink-0 px-1.5 py-0.5 rounded text-[10px] leading-none text-[var(--ln-accent)] border border-[var(--ln-accent)]/40 font-mono"
            >Shift+Click</kbd
          >
          <span class="text-default/80 truncate">Lock transforms to axis</span>
        </div>
      </div>
      <p class="text-[10px] text-default/40 px-1 mt-1">
        In Transform mode, click rotates the selection 90° around that axis.
      </p>
    </section>

    <Separator />

    <!-- Tips -->
    <section class="flex flex-col gap-1.5">
      <h3 class="uppercase tracking-wider text-[10px] font-bold text-[var(--ln-accent)]">Tips</h3>
      <ul class="flex flex-col gap-1 text-sm text-default/80">
        <li v-for="(tip, i) in tips" :key="i" class="flex items-start gap-2">
          <UIcon name="i-lucide:circle-dot" class="size-3.5 shrink-0 mt-1 text-[var(--ln-accent)] opacity-60" />
          <span class="leading-relaxed">{{ tip }}</span>
        </li>
      </ul>
    </section>

    <Separator />

    <!-- Links + version footer -->
    <section class="flex flex-col gap-2">
      <h3 class="uppercase tracking-wider text-[10px] font-bold text-[var(--ln-accent)]">Links</h3>
      <div class="flex flex-row gap-2 flex-wrap">
        <UButton
          label="GitHub"
          icon="i-simple-icons:github"
          to="https://github.com/polydera/lunar"
          target="_blank"
          color="neutral"
          variant="outline"
          size="sm"
        />
        <UButton
          label="Docs"
          icon="i-lucide:book-open"
          to="https://trueform.polydera.com/ts/getting-started"
          target="_blank"
          color="neutral"
          variant="outline"
          size="sm"
        />
        <UButton
          label="Report an issue"
          icon="i-lucide:bug"
          to="https://github.com/polydera/lunar/issues/new"
          target="_blank"
          color="neutral"
          variant="outline"
          size="sm"
        />
      </div>
      <p class="text-[10px] text-default/40 font-mono pt-1">Lunar v{{ version }}</p>
    </section>
  </div>
</template>
