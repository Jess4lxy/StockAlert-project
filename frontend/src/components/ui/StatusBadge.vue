<script setup lang="ts">
import type { Tono } from './types';

withDefaults(defineProps<{ tone?: Tono }>(), { tone: 'neutro' });

const TONOS: Record<Tono, string> = {
  exito: 'bg-exito-10 text-exito',
  info: 'bg-info-10 text-info',
  alerta: 'bg-alerta-10 text-alerta',
  error: 'bg-error-10 text-error',
  neutro: 'bg-slate-100 text-slate-600',
  marca: 'bg-marino-10 text-marino',
};
</script>

<template>
  <span class="inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold whitespace-nowrap" :class="TONOS[tone]">
    <slot />
  </span>
</template>
