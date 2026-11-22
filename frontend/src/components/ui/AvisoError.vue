<script setup lang="ts">
// Aviso de error fijo en la parte superior (mismo patrón que el inicio de sesión de Haibu)
import AppIcon from './AppIcon.vue';

const mensaje = defineModel<string>({ required: true });
</script>

<template>
  <div
    v-if="mensaje"
    class="fixed top-4 left-1/2 z-[60] flex w-[calc(100%-2rem)] max-w-2xl -translate-x-1/2 items-start gap-3 rounded-lg border border-error/40 bg-error-10 p-3 shadow-md"
    role="alert"
  >
    <AppIcon name="error" :size="22" class="mt-0.5 text-error" />
    <div class="min-w-0 flex-1">
      <p class="text-xs font-semibold text-error">Error</p>
      <p class="text-sm text-texto">{{ mensaje }}</p>
    </div>
    <button type="button" aria-label="Cerrar aviso" class="rounded-full p-1 text-marino hover:bg-white/60" @click="mensaje = ''">
      <AppIcon name="close" :size="18" />
    </button>
  </div>
</template>
