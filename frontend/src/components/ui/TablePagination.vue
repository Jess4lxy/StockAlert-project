<script setup lang="ts">
// Paginación al estilo de mat-paginator: tamaño de página, rango y botones.
import { computed } from 'vue';
import AppIcon from './AppIcon.vue';
import SelectInput from './SelectInput.vue';

const props = withDefaults(
  defineProps<{ total: number; pageSizeOptions?: number[] }>(),
  { pageSizeOptions: () => [10, 20, 50, 100] },
);
const page = defineModel<number>('page', { required: true });
const limit = defineModel<number>('limit', { required: true });

const totalPaginas = computed(() => Math.max(1, Math.ceil(props.total / limit.value)));
const opciones = computed(() => props.pageSizeOptions.map((n) => ({ value: n, label: String(n) })));

const numero = new Intl.NumberFormat('es-MX');
const rango = computed(() => {
  if (props.total === 0) return '0 de 0';
  const desde = (page.value - 1) * limit.value + 1;
  const hasta = Math.min(page.value * limit.value, props.total);
  return `${numero.format(desde)} – ${numero.format(hasta)} de ${numero.format(props.total)}`;
});

const botones = computed(() => [
  { icon: 'first_page', label: 'Primera página', destino: 1, deshabilitado: page.value <= 1 },
  { icon: 'chevron_left', label: 'Página anterior', destino: page.value - 1, deshabilitado: page.value <= 1 },
  { icon: 'chevron_right', label: 'Página siguiente', destino: page.value + 1, deshabilitado: page.value >= totalPaginas.value },
  { icon: 'last_page', label: 'Última página', destino: totalPaginas.value, deshabilitado: page.value >= totalPaginas.value },
]);
</script>

<template>
  <nav class="flex flex-wrap items-center justify-end gap-x-6 gap-y-2 py-2 text-xs text-texto-suave" aria-label="Paginación">
    <div class="flex items-center gap-2">
      <span>Elementos por página</span>
      <SelectInput v-model="limit" :options="opciones" class="w-20" />
    </div>
    <span class="tabular-nums">{{ rango }}</span>
    <div class="flex items-center">
      <button
        v-for="b in botones"
        :key="b.icon"
        type="button"
        :title="b.label"
        :aria-label="b.label"
        :disabled="b.deshabilitado"
        class="flex h-10 w-10 items-center justify-center rounded-full text-texto transition-colors hover:bg-marino-10 disabled:cursor-default disabled:text-slate-300 disabled:hover:bg-transparent"
        @click="page = b.destino"
      >
        <AppIcon :name="b.icon" :size="22" />
      </button>
    </div>
  </nav>
</template>
