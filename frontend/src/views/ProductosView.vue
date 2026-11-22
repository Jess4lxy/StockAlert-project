<script setup lang="ts">
import { computed, onMounted, reactive, ref, watch } from 'vue';
import { api, mensajeDeError, type EstadoStock, type Pagina, type Producto } from '@/api';
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

const filtros = reactive({ q: '', estado: '', categoria: '', page: 1, limit: 20 });
const resultado = ref<Pagina<Producto> | null>(null);
const categorias = ref<string[]>([]);
const cargando = ref(false);
const error = ref('');

let controlador: AbortController | null = null;

async function cargar() {
  // Cancela la petición anterior si el usuario sigue cambiando filtros
  controlador?.abort();
  controlador = new AbortController();
  cargando.value = true;
  error.value = '';
  try {
    resultado.value = await api.productos({ ...filtros }, controlador.signal);
  } catch (e) {
    if ((e as Error).name === 'AbortError') return;
    error.value = mensajeDeError(e);
  }
  cargando.value = false;
}

function reiniciar() {
  if (filtros.page === 1) cargar();
  else filtros.page = 1;
}

let espera: ReturnType<typeof setTimeout> | undefined;
watch(
  () => filtros.q,
  () => {
    clearTimeout(espera);
    espera = setTimeout(reiniciar, 300);
  },
);
watch(() => [filtros.estado, filtros.categoria, filtros.limit], reiniciar);
watch(() => filtros.page, cargar);

onMounted(async () => {
  cargar();
  categorias.value = await api.categorias().catch(() => []);
});

function limpiar() {
  Object.assign(filtros, { q: '', estado: '', categoria: '' });
}

const opcionesEstado = [
  { value: '', label: 'Todos' },
  { value: 'reponer', label: 'Por reponer (bajo o agotado)' },
  { value: 'bajo', label: 'Bajo su mínimo' },
  { value: 'agotado', label: 'Agotado' },
  { value: 'ok', label: 'En orden' },
];
const opcionesCategoria = computed(() => [
  { value: '', label: 'Todas' },
  ...categorias.value.map((c) => ({ value: c, label: c })),
]);

const columnas: Columna[] = [
  { key: 'nombre', label: 'Producto' },
  { key: 'categoria', label: 'Categoría' },
  { key: 'stock_actual', label: 'Stock actual', align: 'right', class: 'tabular-nums' },
  { key: 'stock_minimo', label: 'Stock mínimo', align: 'right', class: 'tabular-nums' },
  { key: 'precio', label: 'Precio', align: 'right', class: 'tabular-nums whitespace-nowrap' },
  { key: 'estado_stock', label: 'Estado' },
];

const TONO: Record<EstadoStock, Tono> = { ok: 'exito', bajo: 'alerta', agotado: 'error' };
const ETIQUETA: Record<EstadoStock, string> = { ok: 'En orden', bajo: 'Bajo mínimo', agotado: 'Agotado' };

const moneda = new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' });
</script>

<template>
  <section>
    <PageHeader title="Productos" subtitle="Catálogo con el stock actual de cada producto frente a su mínimo." />

    <FilterBar :columns="3">
      <FormField id="buscar-producto" label="Producto">
        <TextInput id="buscar-producto" v-model="filtros.q" type="search" icon="search" placeholder="Ej. cuaderno, pilas, cloro…" />
      </FormField>
      <FormField id="estado-stock" label="Estado del stock">
        <SelectInput id="estado-stock" v-model="filtros.estado" :options="opcionesEstado" />
      </FormField>
      <FormField id="categoria-producto" label="Categoría">
        <SelectInput id="categoria-producto" v-model="filtros.categoria" :options="opcionesCategoria" />
      </FormField>
      <template #actions>
        <BaseButton variant="outline" icon="filter_alt_off" @click="limpiar">Limpiar</BaseButton>
      </template>
    </FilterBar>

    <p v-if="error" class="mb-3 rounded-lg bg-error-10 p-3 text-sm text-error">{{ error }}</p>

    <DataTable
      :columns="columnas"
      :rows="resultado?.data ?? []"
      row-key="id_producto"
      :loading="cargando"
      empty-text="No hay productos con esos filtros."
    >
      <template #cell-nombre="{ row }"><span class="font-medium text-marino">{{ row.nombre }}</span></template>
      <template #cell-precio="{ row }">{{ moneda.format(row.precio) }}</template>
      <template #cell-estado_stock="{ row }">
        <StatusBadge :tone="TONO[row.estado_stock]">{{ ETIQUETA[row.estado_stock] }}</StatusBadge>
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
