<script setup lang="ts">
// Fila de filtros (slot por defecto) con las acciones alineadas a la derecha debajo.
withDefaults(defineProps<{ columns?: number }>(), { columns: 4 });

const GRID: Record<number, string> = {
  2: 'md:grid-cols-2',
  3: 'md:grid-cols-3',
  4: 'md:grid-cols-2 lg:grid-cols-4',
  5: 'md:grid-cols-3 lg:grid-cols-5',
};
</script>

<template>
  <div class="pb-3">
    <div class="grid grid-cols-1 gap-4 pt-3" :class="GRID[columns]">
      <slot />
    </div>
    <div v-if="$slots.actions" class="mt-4 flex flex-col justify-end gap-3 md:flex-row">
      <slot name="actions" />
    </div>
  </div>
</template>
