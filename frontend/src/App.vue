<script setup lang="ts">
import MovimientosPagina from './components/MovimientosPagina.vue';
</script>

<template>
  <div class="min-h-screen bg-slate-50 text-slate-800">
    <header class="bg-marino text-white">
      <div class="mx-auto flex max-w-6xl items-center gap-3 px-4 py-3">
        <img src="/favicon.svg" alt="" class="h-8 w-8" />
        <span class="text-lg font-bold">Stock<span class="text-naranja">Alert</span></span>
        <span class="ml-auto hidden text-sm text-slate-300 sm:inline">Inventario inteligente para tu negocio</span>
      </div>
    </header>
    <main class="mx-auto max-w-6xl px-4 py-6">
      <MovimientosPagina />
    </main>
  </div>
</template>
