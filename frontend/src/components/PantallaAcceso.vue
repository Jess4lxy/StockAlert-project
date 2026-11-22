<script setup lang="ts">
// Marco de las pantallas sin sesión (inicio de sesión y registro): marca arriba y
// el formulario en una tarjeta centrada, como el diálogo de acceso de Haibu.
withDefaults(defineProps<{ ancho?: 'md' | 'lg' }>(), { ancho: 'md' });
const logo = `${import.meta.env.BASE_URL}favicon.svg`;
</script>

<template>
  <div class="flex min-h-screen flex-col bg-fondo" style="padding-top: env(safe-area-inset-top)">
    <header class="bg-marino text-white">
      <div class="mx-auto flex h-14 max-w-5xl items-center gap-3 px-4">
        <img :src="logo" alt="" class="h-8 w-8" />
        <span class="text-lg font-bold">Stock<span class="text-naranja">Alert</span></span>
        <span class="ml-4 hidden text-sm text-white/70 sm:inline">Inventario inteligente para tu negocio</span>
      </div>
    </header>
    <main class="flex flex-1 items-start justify-center px-4 py-8 sm:items-center sm:py-12">
      <div
        class="w-full rounded-2xl bg-white px-6 py-8 shadow-sm ring-1 ring-gray-200 sm:px-10"
        :class="ancho === 'lg' ? 'max-w-2xl' : 'max-w-md'"
      >
        <slot />
      </div>
    </main>
  </div>
</template>
