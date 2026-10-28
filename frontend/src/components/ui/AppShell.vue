<script setup lang="ts">
// Estructura general: barra superior con la marca y riel lateral de íconos
// (en móvil el riel pasa a pestañas horizontales). El contenido va en el slot.
import AppIcon from './AppIcon.vue';
import type { ItemNavegacion } from './types';

defineProps<{ items: ItemNavegacion[] }>();
const activo = defineModel<string>('active', { required: true });
</script>

<template>
  <div class="flex min-h-screen flex-col">
    <header class="sticky top-0 z-40 bg-marino text-white">
      <div class="flex h-14 items-center gap-3 px-4 md:px-6">
        <img src="/favicon.svg" alt="" class="h-8 w-8" />
        <span class="text-lg font-bold">Stock<span class="text-naranja">Alert</span></span>
        <span class="ml-auto hidden text-sm text-white/70 sm:inline">Inventario inteligente para tu negocio</span>
      </div>
    </header>

    <div class="flex flex-1 flex-col lg:flex-row">
      <!-- Riel lateral (escritorio) -->
      <nav class="sticky top-14 hidden h-[calc(100vh-3.5rem)] w-[72px] shrink-0 flex-col items-center gap-1 border-r border-gray-200 bg-white py-3 lg:flex" aria-label="Navegación principal">
        <div v-for="item in items" :key="item.id" class="group relative">
          <button
            type="button"
            :aria-label="item.label"
            :aria-current="item.id === activo ? 'page' : undefined"
            class="flex h-12 w-12 items-center justify-center rounded-[10px] transition-colors"
            :class="item.id === activo ? 'bg-marino-10 text-marino' : 'text-texto-suave hover:bg-marino-10 hover:text-marino'"
            @click="activo = item.id"
          >
            <AppIcon :name="item.icon" :size="24" />
          </button>
          <span
            class="pointer-events-none absolute top-1/2 left-[calc(100%+8px)] z-50 -translate-y-1/2 rounded-lg bg-marino px-3 py-2 text-xs font-medium whitespace-nowrap text-white opacity-0 shadow-lg transition-opacity group-hover:opacity-100"
          >
            {{ item.label }}
          </span>
        </div>
      </nav>

      <!-- Pestañas (móvil y tableta) -->
      <nav class="flex gap-1 border-b border-gray-200 bg-white px-1 py-2 lg:hidden" aria-label="Navegación principal">
        <button
          v-for="item in items"
          :key="item.id"
          type="button"
          class="flex min-w-0 flex-1 items-center justify-center gap-1.5 rounded-full py-2 text-sm font-medium"
          :class="item.id === activo ? 'bg-marino-10 text-marino' : 'text-gray-700 hover:bg-gray-100'"
          @click="activo = item.id"
        >
          <AppIcon :name="item.icon" :size="18" />
          <span class="truncate">{{ item.label }}</span>
        </button>
      </nav>

      <main class="min-w-0 flex-1 px-4 py-3 md:px-6">
        <slot />
      </main>
    </div>
  </div>
</template>
