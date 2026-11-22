<script setup lang="ts">
// Estructura general: barra superior con la marca y riel lateral de íconos
// (en móvil el riel pasa a pestañas horizontales). El contenido va en el slot.
// En la barra superior viven el botón "Instalar" y el indicador de conexión de la PWA.
import { usePwa } from '@/pwa/usePwa';
import AppIcon from './AppIcon.vue';
import type { ItemNavegacion } from './types';

defineProps<{
  items: ItemNavegacion[];
  /** Quién tiene la sesión abierta: nombre y detalle (empresa o rol) */
  usuario?: { nombre: string; detalle: string };
}>();
const emit = defineEmits<{ salir: [] }>();
const activo = defineModel<string>('active', { required: true });

const { enLinea, instalada, puedeInstalar, instalar } = usePwa();
const logo = `${import.meta.env.BASE_URL}favicon.svg`;
</script>

<template>
  <div class="flex min-h-screen flex-col">
    <header class="sticky top-0 z-40 bg-marino text-white" style="padding-top: env(safe-area-inset-top)">
      <div class="flex h-14 items-center gap-3 px-4 md:px-6">
        <img :src="logo" alt="" class="h-8 w-8" />
        <span class="text-lg font-bold">Stock<span class="text-naranja">Alert</span></span>
        <span class="ml-4 hidden text-sm text-white/70 md:inline">Inventario inteligente para tu negocio</span>

        <div class="ml-auto flex items-center gap-2">
          <span
            v-if="!enLinea"
            class="inline-flex items-center gap-1.5 rounded-full bg-alerta-10 px-3 py-1 text-xs font-semibold text-alerta"
            role="status"
          >
            <AppIcon name="wifi_off" :size="16" />
            Sin conexión
          </span>
          <span v-else-if="instalada" class="hidden items-center gap-1.5 text-xs text-white/70 sm:inline-flex">
            <AppIcon name="check_circle" :size="16" />
            App instalada
          </span>

          <button
            v-if="puedeInstalar"
            type="button"
            class="inline-flex h-9 items-center gap-2 rounded-lg bg-naranja px-3 text-sm font-semibold text-white transition-colors hover:brightness-110"
            @click="instalar"
          >
            <AppIcon name="download" :size="18" />
            Instalar app
          </button>

          <div v-if="usuario" class="ml-1 flex items-center gap-2 border-l border-white/20 pl-3">
            <div class="hidden max-w-[220px] text-right leading-tight sm:block">
              <p class="truncate text-sm font-semibold">{{ usuario.nombre }}</p>
              <p class="truncate text-xs text-white/70">{{ usuario.detalle }}</p>
            </div>
            <button
              type="button"
              class="inline-flex h-9 items-center gap-1.5 rounded-lg px-2 text-sm font-medium text-white/90 hover:bg-white/10 hover:text-white"
              :aria-label="`Cerrar sesión de ${usuario.nombre}`"
              @click="emit('salir')"
            >
              <AppIcon name="logout" :size="18" />
              <span class="hidden md:inline">Salir</span>
            </button>
          </div>
        </div>
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
          :aria-current="item.id === activo ? 'page' : undefined"
          class="flex min-w-0 flex-1 flex-col items-center justify-center gap-0.5 rounded-xl py-1.5 text-[11px] font-medium sm:flex-row sm:gap-1.5 sm:rounded-full sm:py-2 sm:text-sm"
          :class="item.id === activo ? 'bg-marino-10 text-marino' : 'text-gray-700 hover:bg-gray-100'"
          @click="activo = item.id"
        >
          <AppIcon :name="item.icon" :size="20" />
          <span class="max-w-full truncate">{{ item.label }}</span>
        </button>
      </nav>

      <main class="min-w-0 flex-1 px-4 py-3 pb-24 md:px-6" style="padding-bottom: max(6rem, env(safe-area-inset-bottom))">
        <slot />
      </main>
    </div>
  </div>
</template>
