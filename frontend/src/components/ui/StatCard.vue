<script setup lang="ts">
// Tarjeta de indicador: etiqueta, valor principal y detalle opcional (slot).
import AppIcon from './AppIcon.vue';

defineProps<{ label: string; value: string; icon?: string; alert?: boolean }>();
</script>

<template>
  <article class="flex flex-col gap-2 rounded-lg border border-slate-200 bg-white p-5">
    <div class="flex items-center justify-between gap-3">
      <h2 class="text-xs font-semibold text-texto-suave">{{ label }}</h2>
      <span
        v-if="icon"
        class="flex h-9 w-9 items-center justify-center rounded-lg"
        :class="alert ? 'bg-error-10 text-error' : 'bg-marino-10 text-marino'"
      >
        <AppIcon :name="icon" />
      </span>
    </div>
    <p class="text-3xl font-semibold text-marino tabular-nums">{{ value }}</p>
    <div v-if="$slots.default" class="text-sm text-texto-suave">
      <slot />
    </div>
  </article>
</template>
