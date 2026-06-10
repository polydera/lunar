<script setup lang="ts">
import { useBreakpoint } from '@/composables/useBreakpoint'
import Separator from './Separator.vue'

const isMac = navigator.platform.startsWith('Mac')
const { isMobile } = useBreakpoint()

interface ModeRow {
  icon: string
  label: string
  kbd?: string
  description: string
  mobileDescription?: string
  mobileOnly?: boolean
  desktopOnly?: boolean
}

const modes: ModeRow[] = [
  {
    icon: 'i-hugeicons:move',
    label: 'Normal',
    description:
      'Click a mesh to select, click empty space to clear. Drag a selected mesh to translate the selection in the view plane; drag a non-selected mesh to translate just that mesh. Drag empty space to orbit the camera around the scene center. Shift+drag empty space to pan.',
    mobileDescription:
      'Tap a mesh to select, tap empty space to clear (or back out of any open UI). One-finger drag on a mesh translates the selection in the view plane. One-finger drag on empty space orbits the camera. Two-finger drag pans.',
  },
  {
    icon: 'i-hugeicons:rotate-clockwise',
    label: 'Transform',
    kbd: 'T',
    description:
      "Drag a selected mesh to rotate the selection around that mesh's center; drag a non-selected mesh to rotate just that mesh. Drag empty space to rotate the selection around the world point under the cursor (requires a selection). Scroll to scale each mesh around its own center.",
    mobileDescription:
      "Tap the mode chip to enter Transform. One-finger drag on a mesh rotates the selection around that mesh's center. One-finger drag on empty space rotates the selection around the cursor (requires a selection). Two-finger pinch scales the selection — camera zoom is suppressed in this mode.",
  },
  {
    icon: 'i-hugeicons:orbit-01',
    label: 'Camera',
    kbd: 'C',
    description:
      "Drag to orbit the camera. On a mesh, the pivot is that mesh's center; on empty space, the pivot is the world point under the cursor.",
    desktopOnly: true,
  },
  {
    icon: 'i-hugeicons:add-circle',
    label: 'Append',
    kbd: 'Ctrl',
    description: 'Click a mesh to add it to the selection; click a selected mesh to remove it.',
    desktopOnly: true,
  },
]

const visibleModes = computed(() =>
  modes.filter((m) => (isMobile.value ? !m.desktopOnly : !m.mobileOnly)),
)

interface ModifierRow {
  icon: string
  label: string
  description: string
}

const desktopModifiers: ModifierRow[] = [
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

const mobileModifiers: ModifierRow[] = [
  {
    icon: 'i-lucide:plus-circle',
    label: 'Add to selection',
    description:
      'Long-press a mesh in the viewport, or long-press a row in the Objects panel, to add it to the selection without clearing the rest.',
  },
  {
    icon: 'i-lucide:move',
    label: 'Pan',
    description: 'Two-finger drag pans the camera in any mode.',
  },
]

interface KeyRow {
  kbd: string
  label: string
}

const desktopKeys: KeyRow[] = [
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

const mobileGestures: KeyRow[] = [
  { kbd: 'Tap mesh', label: 'Select' },
  { kbd: 'Tap empty', label: 'Back / clear selection' },
  { kbd: 'Long-press mesh', label: 'Add to selection' },
  { kbd: 'Long-press row', label: 'Add to selection (Objects panel)' },
  { kbd: 'Double-tap mesh', label: 'Focus mesh' },
  { kbd: 'Double-tap empty', label: 'Fit scene' },
  { kbd: '1-finger drag', label: 'Translate / rotate / orbit (mode-dependent)' },
  { kbd: '2-finger pinch', label: 'Zoom camera, or scale selection in Transform' },
  { kbd: '2-finger drag', label: 'Pan camera' },
  { kbd: 'Tap mode chip', label: 'Toggle Transform mode' },
]

const mobileChips = [
  { icon: 'i-lucide:wrench', label: 'Tools', description: 'Operators, categories, parameters' },
  { icon: 'i-lucide:layers', label: 'Objects', description: 'Scene tree with visibility, color, and rename' },
  { icon: 'i-lucide:list-checks', label: 'Tasks', description: 'Running and recent operations' },
]

const tips = computed(() =>
  isMobile.value
    ? [
        'Tap the search icon in the top-right header to find any operator, action, or link by name.',
        'A tap on the viewport while a panel is open backs out one step (cancel preview → back drill-in → close panel). Selection is preserved.',
        'Run Inspect → Curvature, then Style → Color by Array to visualize per-vertex data on the mesh surface.',
        'The axes widget (bottom-left) shows camera orientation. Positive dots are filled, negative dots are hollow.',
      ]
    : [
        'Drag and drop STL or OBJ files onto the viewport to import.',
        'Run Inspect → Curvature, then Style → Color by Array to visualize per-vertex data on the mesh surface.',
        'The axes widget (bottom-left) shows camera orientation. Positive dots are filled, negative dots are hollow.',
        `Press ${isMac ? '⌘ K' : 'Ctrl + K'} to find any operator, action, or link by name.`,
      ],
)

const version = '0.9.7'
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
      <p v-if="!isMobile" class="text-sm text-default/60 leading-relaxed">
        Press
        <kbd
          class="px-1.5 py-0.5 rounded text-[10px] leading-none text-[var(--ln-accent)] border border-[var(--ln-accent)]/40"
          >{{ isMac ? '⌘ K' : 'Ctrl + K' }}</kbd
        >
        to quickly find any operator or action.
      </p>
      <p v-else class="text-sm text-default/60 leading-relaxed">
        Tap the
        <UIcon name="i-lucide:search" class="size-3.5 inline-block text-[var(--ln-accent)] align-text-bottom" /> icon in the
        header to find any operator or action.
      </p>
      <p class="text-sm text-default/60 leading-relaxed">
        Connect any AI assistant (Claude, Gemini, Codex) to control Lunar via MCP. Tap
        <UIcon name="i-lucide:bot" class="size-3.5 inline-block text-[var(--ln-accent)] align-text-bottom" /> in the
        {{ isMobile ? 'overflow menu' : 'header' }} for setup.
      </p>
    </section>

    <Separator />

    <!-- Interaction model -->
    <section class="flex flex-col gap-1.5">
      <h3 class="uppercase tracking-wider text-[10px] font-bold text-[var(--ln-accent)]">Select first, then act</h3>
      <p v-if="!isMobile" class="text-sm text-default/80 leading-relaxed">
        Click a mesh in the viewport or the Objects list to select it. {{ isMac ? '⌘' : 'Ctrl' }}-click to extend the
        selection. Open a category (Inspect, Cut, Refine, Style, …) or press
        <kbd
          class="px-1.5 py-0.5 rounded text-[10px] leading-none text-[var(--ln-accent)] border border-[var(--ln-accent)]/40"
          >{{ isMac ? '⌘ K' : 'Ctrl + K' }}</kbd
        >
        to run any operator on the selection.
      </p>
      <p v-else class="text-sm text-default/80 leading-relaxed">
        Tap a mesh in the viewport, or open the Objects panel and tap a row, to select. Long-press extends the selection
        in either place. Open the Tools panel for operator categories, or use the search icon to find an operator by name.
      </p>
      <p class="text-sm text-default/80 leading-relaxed mt-1">
        Operators read the selection in three ways. Single-input operators run on each selected mesh in parallel. Multi-input
        operators consume meshes in selection order. Array operators take the whole selection as one set.
      </p>
    </section>

    <Separator />

    <!-- Mobile-only: panel guide -->
    <template v-if="isMobile">
      <section class="flex flex-col gap-2">
        <h3 class="uppercase tracking-wider text-[10px] font-bold text-[var(--ln-accent)]">Panels</h3>
        <div class="flex flex-col gap-2">
          <div v-for="c in mobileChips" :key="c.label" class="flex items-start gap-3 px-1">
            <UIcon :name="c.icon" class="size-5 shrink-0 mt-0.5 text-[var(--ln-accent)] opacity-60" />
            <div class="flex flex-col gap-0.5 flex-1 min-w-0">
              <span class="text-sm font-semibold">{{ c.label }}</span>
              <p class="text-xs text-default/70 leading-relaxed">{{ c.description }}</p>
            </div>
          </div>
        </div>
        <p class="text-[10px] text-default/40 px-1 mt-1">
          Tap an icon in the top-left chip to open. Tap it again, or tap the viewport, to close.
        </p>
      </section>
      <Separator />
    </template>

    <!-- Interaction modes -->
    <section class="flex flex-col gap-2">
      <h3 class="uppercase tracking-wider text-[10px] font-bold text-[var(--ln-accent)]">Interaction modes</h3>
      <div class="flex flex-col gap-2">
        <div v-for="m in visibleModes" :key="m.label" class="flex items-start gap-3 px-1">
          <UIcon :name="m.icon" class="size-5 shrink-0 mt-0.5 text-[var(--ln-accent)] opacity-60" />
          <div class="flex flex-col gap-0.5 flex-1 min-w-0">
            <div class="flex items-center gap-2">
              <span class="text-sm font-semibold">{{ m.label }}</span>
              <kbd
                v-if="m.kbd && !isMobile"
                class="px-1.5 py-0.5 rounded text-[10px] leading-none text-[var(--ln-accent)] border border-[var(--ln-accent)]/40"
                >{{ m.kbd }}</kbd
              >
            </div>
            <p class="text-xs text-default/70 leading-relaxed">
              {{ isMobile && m.mobileDescription ? m.mobileDescription : m.description }}
            </p>
          </div>
        </div>
      </div>
      <p v-if="!isMobile" class="text-[10px] text-default/40 px-1 mt-1">
        Hold key for momentary. Shift+key to lock. N or Escape to release.
      </p>
      <p v-else class="text-[10px] text-default/40 px-1 mt-1">
        Tap the mode chip in the top strip to toggle Transform mode. Tap again to return to Normal.
      </p>
    </section>

    <Separator />

    <!-- Modifiers -->
    <section class="flex flex-col gap-2">
      <h3 class="uppercase tracking-wider text-[10px] font-bold text-[var(--ln-accent)]">
        {{ isMobile ? 'Touch modifiers' : 'Modifiers' }}
      </h3>
      <div class="flex flex-col gap-2">
        <div v-for="m in isMobile ? mobileModifiers : desktopModifiers" :key="m.label" class="flex items-start gap-3 px-1">
          <UIcon :name="m.icon" class="size-5 shrink-0 mt-0.5 text-[var(--ln-accent)] opacity-60" />
          <div class="flex flex-col gap-0.5 flex-1 min-w-0">
            <span class="text-sm font-semibold">{{ m.label }}</span>
            <p class="text-xs text-default/70 leading-relaxed">{{ m.description }}</p>
          </div>
        </div>
      </div>
      <p v-if="!isMobile" class="text-[10px] text-default/40 px-1 mt-1">Modifiers stack with any mode. N or Escape clears all.</p>
    </section>

    <Separator />

    <!-- Reference: Keyboard (desktop) or Touch Gestures (mobile) -->
    <section class="flex flex-col gap-2">
      <h3 class="uppercase tracking-wider text-[10px] font-bold text-[var(--ln-accent)]">
        {{ isMobile ? 'Touch gestures' : 'Keyboard' }}
      </h3>
      <div :class="isMobile ? 'flex flex-col gap-1.5 text-sm' : 'grid grid-cols-2 gap-x-6 gap-y-1.5 text-sm'">
        <div v-for="k in isMobile ? mobileGestures : desktopKeys" :key="k.kbd" class="flex items-center gap-3 min-w-0">
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
      <div v-if="!isMobile" class="grid grid-cols-2 gap-x-6 gap-y-1.5 text-sm">
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
      <div v-else class="flex flex-col gap-1.5 text-sm">
        <div class="flex items-center gap-3 min-w-0">
          <kbd
            class="shrink-0 px-1.5 py-0.5 rounded text-[10px] leading-none text-[var(--ln-accent)] border border-[var(--ln-accent)]/40 font-mono"
            >Tap</kbd
          >
          <span class="text-default/80 truncate">Rotate camera 90° around axis</span>
        </div>
      </div>
      <p class="text-[10px] text-default/40 px-1 mt-1">
        In Transform mode, {{ isMobile ? 'tap' : 'click' }} rotates the selection 90° around that axis.
        <span v-if="isMobile">Axis lock and snap-to-view need modifier keys and aren't available on touch.</span>
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
