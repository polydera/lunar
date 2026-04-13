<script setup lang="ts">
import { prefs, resetPreferences } from '@/composables/usePreferences'
import { COLOR_MAP_NAMES } from '@/core'
import Separator from './Separator.vue'
import FormField from './FormField.vue'

const colorMapItems = COLOR_MAP_NAMES.map((n) => ({ label: n, value: n }))
</script>

<template>
  <div class="flex flex-col gap-4 px-4 py-3">
    <!-- General -->
    <section class="flex flex-col gap-2">
      <h3 class="uppercase tracking-wider text-[10px] font-bold text-[var(--ln-accent)]">General</h3>
      <FormField label="Prevent page refresh" description="Show a confirmation dialog when closing or refreshing the page">
        <USwitch v-model="prefs.preventRefresh" />
      </FormField>
      <FormField label="Auto-fit on import" description="Fit the camera to the scene after importing a file">
        <USwitch v-model="prefs.autoFitOnImport" />
      </FormField>
      <FormField label="Show onboarding" description="Show the start wizard when the scene is empty">
        <USwitch :model-value="!prefs.skipOnboarding" @update:model-value="prefs.skipOnboarding = !$event" />
      </FormField>
    </section>

    <Separator />

    <!-- Defaults -->
    <section class="flex flex-col gap-2">
      <h3 class="uppercase tracking-wider text-[10px] font-bold text-[var(--ln-accent)]">Defaults</h3>
      <FormField label="Colormap" description="Default colormap for Color by Array">
        <USelect v-model="prefs.defaultColormap" :items="colorMapItems" size="xs" class="w-full" />
      </FormField>
      <FormField label="Object color" description="Default color for new meshes">
        <UPopover>
          <div
            class="size-6 rounded-md cursor-pointer border border-default/20"
            :style="{ backgroundColor: prefs.defaultObjectColor }"
          />
          <template #content>
            <div class="p-2">
              <UColorPicker v-model="prefs.defaultObjectColor" />
            </div>
          </template>
        </UPopover>
      </FormField>
      <FormField label="Curves color" description="Default color for curve overlays">
        <UPopover>
          <div
            class="size-6 rounded-md cursor-pointer border border-default/20"
            :style="{ backgroundColor: prefs.defaultCurvesColor }"
          />
          <template #content>
            <div class="p-2">
              <UColorPicker v-model="prefs.defaultCurvesColor" />
            </div>
          </template>
        </UPopover>
      </FormField>
    </section>

    <Separator />

    <!-- Viewport -->
    <section class="flex flex-col gap-2">
      <h3 class="uppercase tracking-wider text-[10px] font-bold text-[var(--ln-accent)]">Viewport</h3>
      <FormField label="Zoom speed" description="Wheel / pinch zoom sensitivity multiplier">
        <div class="flex flex-row gap-2 items-center w-full">
          <USlider v-model="prefs.zoomSpeed" :min="0.5" :max="2" :step="0.1" />
          <span class="text-xs text-default/70 w-8 text-right shrink-0">{{ prefs.zoomSpeed.toFixed(1) }}</span>
        </div>
      </FormField>
    </section>

    <Separator />

    <!-- Reset -->
    <div class="flex justify-end">
      <UButton
        label="Reset to defaults"
        icon="i-lucide:rotate-ccw"
        color="neutral"
        variant="ghost"
        size="sm"
        @click="resetPreferences"
      />
    </div>
  </div>
</template>
