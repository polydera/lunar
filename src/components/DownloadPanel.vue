<script setup lang="ts">
const emit = defineEmits<{
  select: [name: string, url: string]
}>()

interface MeshEntry {
  name: string
  description: string
  icon: string
  url: string
}

const BASE = 'https://polydera-files.s3.eu-central-1.amazonaws.com/lunar/meshes/'

const meshes: MeshEntry[] = [
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
</script>

<template>
  <div class="flex flex-col gap-1 px-1">
    <div
      v-for="m in meshes"
      :key="m.name"
      class="flex items-center gap-3 px-3 py-2.5 rounded-md hover:bg-[var(--ln-hover)] cursor-pointer transition-colors"
      @click="emit('select', m.name, m.url)"
    >
      <UIcon :name="m.icon" class="size-4 shrink-0 text-[var(--ln-accent)] opacity-60" />
      <div class="flex-1 min-w-0">
        <div class="text-sm font-medium">{{ m.name }}</div>
        <div class="text-[10px] text-default/40 truncate">{{ m.description }}</div>
      </div>
    </div>
  </div>
</template>
