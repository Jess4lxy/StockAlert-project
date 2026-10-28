<script setup lang="ts">
import { computed, onMounted, reactive, ref, watch } from 'vue';
import { api, type Movimiento, type Pagina, type TipoMovimiento } from '@/api';
import {
  BaseButton,
  DataTable,
  FilterBar,
  FormField,
  PageHeader,
  SelectInput,
  StatusBadge,
  TablePagination,
  TextInput,
  type Columna,
  type Tono,
} from '@/components/ui';

const filtros = reactive({ q: '', tipo: '', categoria: '', page: 1, limit: 20 });
const resultado = ref<Pagina<Movimiento> | null>(null);
const categorias = ref<string[]>([]);
const cargando = ref(false);
const error = ref('');

let controlador: AbortController | null = null;

async function cargar() {
  // Cancela la petición anterior si el usuario sigue escribiendo o cambiando filtros
  controlador?.abort();
  controlador = new AbortController();
  cargando.value = true;
  error.value = '';
  try {
    resultado.value = await api.movimientos({ ...filtros }, controlador.signal);
  } catch (e) {
    if ((e as Error).name === 'AbortError') return;
    error.value = 'No se pudo conectar con la API. ¿Está corriendo el backend?';
  }
  cargando.value = false;
}

// Cualquier cambio de búsqueda o filtro regresa a la primera página
function reiniciar() {
  if (filtros.page === 1) cargar();
  else filtros.page = 1;
}

// La búsqueda espera a que el usuario deje de escribir para no hacer una petición por tecla
let espera: ReturnType<typeof setTimeout> | undefined;
watch(
  () => filtros.q,
  () => {
    clearTimeout(espera);
    espera = setTimeout(reiniciar, 300);
  },
);
watch(() => [filtros.tipo, filtros.categoria, filtros.limit], reiniciar);
watch(() => filtros.page, cargar);

onMounted(async () => {
  cargar();
  categorias.value = await api.categorias().catch(() => []);
});

function limpiar() {
  Object.assign(filtros, { q: '', tipo: '', categoria: '' });
}

const opcionesTipo = [
  { value: '', label: 'Todos' },
  { value: 'entrada', label: 'Entrada' },
  { value: 'salida', label: 'Salida' },
  { value: 'ajuste', label: 'Ajuste' },
];
const opcionesCategoria = computed(() => [
  { value: '', label: 'Todas' },
  ...categorias.value.map((c) => ({ value: c, label: c })),
]);

const columnas: Columna[] = [
  { key: 'id_movimiento', label: 'Folio', class: 'whitespace-nowrap' },
  { key: 'fecha_movimiento', label: 'Fecha', class: 'whitespace-nowrap' },
  { key: 'producto', label: 'Producto' },
  { key: 'categoria', label: 'Categoría' },
  { key: 'tipo_movimiento', label: 'Tipo' },
  { key: 'cantidad', label: 'Cantidad', align: 'right', class: 'tabular-nums' },
  { key: 'usuario', label: 'Usuario', class: 'whitespace-nowrap' },
  { key: 'observaciones', label: 'Observaciones' },
];

const TONO_TIPO: Record<TipoMovimiento, Tono> = { entrada: 'exito', salida: 'info', ajuste: 'alerta' };

const fecha = new Intl.DateTimeFormat('es-MX', {
  timeZone: 'America/Merida',
  dateStyle: 'medium',
  timeStyle: 'short',
});

// Las salidas restan y los ajustes pueden sumar o restar
function cantidad(m: Movimiento): string {
  if (m.tipo_movimiento === 'salida') return `−${m.cantidad}`;
  if (m.tipo_movimiento === 'ajuste') return m.cantidad > 0 ? `+${m.cantidad}` : `−${-m.cantidad}`;
  return `+${m.cantidad}`;
}
</script>

<template>
  <section>
    <PageHeader title="Movimientos de inventario" subtitle="Entradas, salidas y ajustes registrados en el almacén." />

    <FilterBar :columns="3">
      <FormField id="buscar" label="Producto">
        <TextInput id="buscar" v-model="filtros.q" type="search" icon="search" placeholder="Ej. cuaderno, pilas, cloro…" />
      </FormField>
      <FormField id="tipo" label="Tipo de movimiento">
        <SelectInput id="tipo" v-model="filtros.tipo" :options="opcionesTipo" />
      </FormField>
      <FormField id="categoria" label="Categoría">
        <SelectInput id="categoria" v-model="filtros.categoria" :options="opcionesCategoria" />
      </FormField>
      <template #actions>
        <BaseButton variant="outline" icon="filter_alt_off" @click="limpiar">Limpiar</BaseButton>
      </template>
    </FilterBar>

    <p v-if="error" class="mb-3 rounded-lg bg-error-10 p-3 text-sm text-error">{{ error }}</p>

    <DataTable
      :columns="columnas"
      :rows="resultado?.data ?? []"
      row-key="id_movimiento"
      :loading="cargando"
      empty-text="No hay movimientos con esos filtros."
    >
      <template #cell-id_movimiento="{ row }">
        <span class="font-mono text-xs text-texto-suave">MOV-{{ String(row.id_movimiento).padStart(6, '0') }}</span>
      </template>
      <template #cell-fecha_movimiento="{ row }">{{ fecha.format(new Date(row.fecha_movimiento)) }}</template>
      <template #cell-producto="{ row }"><span class="font-medium text-marino">{{ row.producto }}</span></template>
      <template #cell-tipo_movimiento="{ row }">
        <StatusBadge :tone="TONO_TIPO[row.tipo_movimiento]" class="capitalize">{{ row.tipo_movimiento }}</StatusBadge>
      </template>
      <template #cell-cantidad="{ row }">{{ cantidad(row) }}</template>
      <template #cell-observaciones="{ row }">
        <span class="text-texto-suave">{{ row.observaciones ?? '—' }}</span>
      </template>
    </DataTable>

    <TablePagination
      v-if="resultado"
      v-model:page="filtros.page"
      v-model:limit="filtros.limit"
      :total="resultado.total"
      class="mt-2"
    />
  </section>
</template>
