<script setup lang="ts" generic="T">
// Tabla de datos: encabezado como barra redondeada separada de
// las filas y filas alternadas. En pantallas chicas cada fila se vuelve una
// tarjeta con la etiqueta de cada campo.
//
// Uso: <DataTable :columns :rows row-key="id"> + slots opcionales
// `#cell-<key>="{ row }"` para dibujar una celda a la medida.
import type { Columna } from './types';

const props = withDefaults(
  defineProps<{
    columns: Columna[];
    rows: T[];
    rowKey: keyof T & string;
    loading?: boolean;
    emptyText?: string;
  }>(),
  { emptyText: 'No hay registros para mostrar.' },
);

defineSlots<{
  [slot: `cell-${string}`]: (props: { row: T }) => unknown;
  empty?: () => unknown;
}>();

const ALINEACION = { left: 'text-left', center: 'text-center', right: 'text-right' };

function valor(row: T, key: string): unknown {
  return (row as Record<string, unknown>)[key];
}

function clave(row: T): string {
  return String(valor(row, props.rowKey));
}
</script>

<template>
  <div class="tabla-datos overflow-x-auto" :aria-busy="loading">
    <table class="w-full border-separate border-spacing-0 text-sm transition-opacity" :class="{ 'opacity-50': loading }">
      <thead>
        <tr>
          <th
            v-for="col in columns"
            :key="col.key"
            scope="col"
            class="bg-marino px-4 py-3 text-[13px] font-semibold tracking-wide whitespace-nowrap text-white first:rounded-l-lg last:rounded-r-lg"
            :class="ALINEACION[col.align ?? 'left']"
          >
            {{ col.label }}
          </th>
        </tr>
        <!-- Separación entre el encabezado y las filas -->
        <tr aria-hidden="true" class="espaciador"><td :colspan="columns.length" class="h-2 p-0" /></tr>
      </thead>
      <tbody>
        <tr v-for="row in rows" :key="clave(row)" class="fila odd:bg-white even:bg-fila">
          <td
            v-for="col in columns"
            :key="col.key"
            :data-label="col.label"
            class="px-4 py-3.5 text-texto"
            :class="[ALINEACION[col.align ?? 'left'], col.class]"
          >
            <slot :name="`cell-${col.key}`" :row="row">{{ valor(row, col.key) ?? '—' }}</slot>
          </td>
        </tr>
        <tr v-if="!loading && rows.length === 0">
          <td :colspan="columns.length" class="bg-white px-4 py-10 text-center text-texto-suave">
            <slot name="empty">{{ emptyText }}</slot>
          </td>
        </tr>
      </tbody>
    </table>
  </div>
</template>

<style scoped>
@reference "../../style.css";

/* Primera y última celda de cada fila con esquinas redondeadas, como el encabezado */
.fila td:first-child {
  @apply rounded-l-lg;
}
.fila td:last-child {
  @apply rounded-r-lg;
}

/* Móvil: cada fila es una tarjeta de dos columnas con la etiqueta encima del valor */
@media (max-width: 767px) {
  thead {
    display: none;
  }
  table,
  tbody {
    display: block;
  }
  .fila {
    @apply mb-3 grid grid-cols-2 gap-x-4 gap-y-3 rounded-lg border border-slate-200 bg-white p-4;
  }
  .fila td {
    @apply rounded-none p-0 text-left;
  }
  .fila td::before {
    content: attr(data-label);
    @apply mb-1 block text-[11px] font-semibold text-texto-suave;
  }
}
</style>
