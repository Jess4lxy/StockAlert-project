<script setup lang="ts">
import { computed } from 'vue';

const props = defineProps<{ page: number; totalPages: number; total: number; limit: number }>();
const emit = defineEmits<{ cambiar: [page: number] }>();

const desde = computed(() => (props.total === 0 ? 0 : (props.page - 1) * props.limit + 1));
const hasta = computed(() => Math.min(props.page * props.limit, props.total));
const numero = new Intl.NumberFormat('es-MX');
</script>

<template>
  <div class="flex flex-wrap items-center justify-between gap-3 text-sm">
    <p class="text-slate-600">
      Mostrando {{ numero.format(desde) }}–{{ numero.format(hasta) }} de {{ numero.format(total) }} movimientos
    </p>
    <div class="flex items-center gap-1">
      <button class="btn" :disabled="page <= 1" aria-label="Primera página" @click="emit('cambiar', 1)">«</button>
      <button class="btn" :disabled="page <= 1" @click="emit('cambiar', page - 1)">Anterior</button>
      <span class="px-2 text-slate-600">Página {{ page }} de {{ numero.format(totalPages) }}</span>
      <button class="btn" :disabled="page >= totalPages" @click="emit('cambiar', page + 1)">Siguiente</button>
      <button class="btn" :disabled="page >= totalPages" aria-label="Última página" @click="emit('cambiar', totalPages)">»</button>
    </div>
  </div>
</template>

<style scoped>
@reference "../style.css";

.btn {
  @apply rounded-md border border-slate-300 bg-white px-3 py-1.5 hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-40;
}
</style>
