<script setup lang="ts">
// Contenedor de gráfica con título y un botón para ver los mismos datos como
// tabla (la tabla hace accesibles los valores sin depender del color ni del hover).
import { ref } from 'vue';
import AppIcon from './AppIcon.vue';

defineProps<{ title: string; subtitle?: string }>();
const verTabla = ref(false);
</script>

<template>
  <section class="flex min-w-0 flex-col rounded-lg border border-slate-200 bg-white p-5">
    <header class="mb-4 flex items-start justify-between gap-3">
      <div>
        <h2 class="text-base font-semibold text-texto">{{ title }}</h2>
        <p v-if="subtitle" class="mt-0.5 text-xs text-texto-suave">{{ subtitle }}</p>
      </div>
      <button
        v-if="$slots.table"
        type="button"
        class="flex shrink-0 items-center gap-1 rounded-lg px-2 py-1 text-xs font-semibold text-marino hover:bg-marino-10"
        :aria-pressed="verTabla"
        @click="verTabla = !verTabla"
      >
        <AppIcon :name="verTabla ? 'bar_chart' : 'table'" :size="18" />
        {{ verTabla ? 'Ver gráfica' : 'Ver tabla' }}
      </button>
    </header>
    <div class="min-h-0 flex-1">
      <slot v-if="verTabla" name="table" />
      <slot v-else />
    </div>
  </section>
</template>
