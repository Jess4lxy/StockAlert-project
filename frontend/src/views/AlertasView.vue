<script setup lang="ts">
import { onMounted, reactive, ref, watch } from 'vue';
import { api, mensajeDeError, type Alerta, type EstadoAlerta, type Pagina, type TipoAlerta } from '@/api';
import {
  BaseButton,
  DataTable,
  FilterBar,
  FormField,
  PageHeader,
  SelectInput,
  StatCard,
  StatusBadge,
  TablePagination,
  type Columna,
  type Tono,
} from '@/components/ui';

const filtros = reactive({ estado: '', tipo: '', page: 1, limit: 20 });
const resultado = ref<Pagina<Alerta> | null>(null);
const resumen = ref({ pendientes: 0, total: 0 });
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
    resultado.value = await api.alertas({ ...filtros }, controlador.signal);
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

watch(() => [filtros.estado, filtros.tipo, filtros.limit], reiniciar);
watch(() => filtros.page, cargar);

onMounted(async () => {
  cargar();
  resumen.value = await api.resumenAlertas().catch(() => resumen.value);
});

function limpiar() {
  Object.assign(filtros, { estado: '', tipo: '' });
}

const opcionesEstado = [
  { value: '', label: 'Todos' },
  { value: 'pendiente', label: 'Pendiente' },
  { value: 'atendida', label: 'Atendida' },
  { value: 'cerrada', label: 'Cerrada' },
];
const opcionesTipo = [
  { value: '', label: 'Todos' },
  { value: 'stock_bajo', label: 'Stock bajo' },
  { value: 'agotado', label: 'Agotado' },
];

const columnas: Columna[] = [
  { key: 'id_alerta', label: 'Folio', class: 'whitespace-nowrap' },
  { key: 'fecha_generacion', label: 'Generada', class: 'whitespace-nowrap' },
  { key: 'producto', label: 'Producto' },
  { key: 'categoria', label: 'Categoría' },
  { key: 'tipo_alerta', label: 'Tipo' },
  { key: 'stock_detectado', label: 'Stock detectado', align: 'right', class: 'tabular-nums' },
  { key: 'estado', label: 'Estado' },
  { key: 'fecha_atencion', label: 'Atendida', class: 'whitespace-nowrap' },
];

const TONO_ESTADO: Record<EstadoAlerta, Tono> = { pendiente: 'error', atendida: 'exito', cerrada: 'neutro' };
const TONO_TIPO: Record<TipoAlerta, Tono> = { stock_bajo: 'alerta', agotado: 'error' };
const ETIQUETA_TIPO: Record<TipoAlerta, string> = { stock_bajo: 'Stock bajo', agotado: 'Agotado' };

const fecha = new Intl.DateTimeFormat('es-MX', { timeZone: 'America/Merida', dateStyle: 'medium', timeStyle: 'short' });
</script>

<template>
  <section>
    <PageHeader title="Alertas de stock" subtitle="Se generan cuando un producto baja de su stock mínimo y se cierran al reponerlo." />

    <div class="grid gap-4 py-2 md:grid-cols-2">
      <StatCard label="Alertas pendientes" :value="String(resumen.pendientes)" icon="notifications" :alert="resumen.pendientes > 0">
        productos que siguen sin reponerse
      </StatCard>
      <StatCard label="Alertas registradas en el año" :value="String(resumen.total)" icon="inventory_2">
        entre pendientes, atendidas y cerradas
      </StatCard>
    </div>

    <FilterBar :columns="2">
      <FormField id="estado-alerta" label="Estado">
        <SelectInput id="estado-alerta" v-model="filtros.estado" :options="opcionesEstado" />
      </FormField>
      <FormField id="tipo-alerta" label="Tipo de alerta">
        <SelectInput id="tipo-alerta" v-model="filtros.tipo" :options="opcionesTipo" />
      </FormField>
      <template #actions>
        <BaseButton variant="outline" icon="filter_alt_off" @click="limpiar">Limpiar</BaseButton>
      </template>
    </FilterBar>

    <p v-if="error" class="mb-3 rounded-lg bg-error-10 p-3 text-sm text-error">{{ error }}</p>

    <DataTable
      :columns="columnas"
      :rows="resultado?.data ?? []"
      row-key="id_alerta"
      :loading="cargando"
      empty-text="No hay alertas con esos filtros."
    >
      <template #cell-id_alerta="{ row }">
        <span class="font-mono text-xs text-texto-suave">ALT-{{ String(row.id_alerta).padStart(5, '0') }}</span>
      </template>
      <template #cell-fecha_generacion="{ row }">{{ fecha.format(new Date(row.fecha_generacion)) }}</template>
      <template #cell-producto="{ row }"><span class="font-medium text-marino">{{ row.producto }}</span></template>
      <template #cell-tipo_alerta="{ row }">
        <StatusBadge :tone="TONO_TIPO[row.tipo_alerta]">{{ ETIQUETA_TIPO[row.tipo_alerta] }}</StatusBadge>
      </template>
      <template #cell-estado="{ row }">
        <StatusBadge :tone="TONO_ESTADO[row.estado]" class="capitalize">{{ row.estado }}</StatusBadge>
      </template>
      <template #cell-fecha_atencion="{ row }">
        <span class="text-texto-suave">{{ row.fecha_atencion ? fecha.format(new Date(row.fecha_atencion)) : '—' }}</span>
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
