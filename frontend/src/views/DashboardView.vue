<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue';
import { api, type Dashboard } from '@/api';
import BarChart from '@/components/charts/BarChart.vue';
import LineChart from '@/components/charts/LineChart.vue';
import { COLOR } from '@/components/charts/tema';
import {
  AppIcon,
  ChartCard,
  DataTable,
  FormField,
  PageHeader,
  SelectInput,
  StatCard,
  StatusBadge,
  type Columna,
} from '@/components/ui';

const meses = ref(6);
const datos = ref<Dashboard | null>(null);
const cargando = ref(false);
const error = ref('');

let controlador: AbortController | null = null;

async function cargar() {
  controlador?.abort();
  controlador = new AbortController();
  cargando.value = true;
  error.value = '';
  try {
    datos.value = await api.dashboard(meses.value, controlador.signal);
  } catch (e) {
    if ((e as Error).name === 'AbortError') return;
    error.value = 'No se pudo conectar con la API. ¿Está corriendo el backend?';
  }
  cargando.value = false;
}

watch(meses, cargar);
onMounted(cargar);

const opcionesPeriodo = [
  { value: 3, label: 'Últimos 3 meses' },
  { value: 6, label: 'Últimos 6 meses' },
  { value: 12, label: 'Últimos 12 meses' },
];

const numero = new Intl.NumberFormat('es-MX');
const porcentaje = new Intl.NumberFormat('es-MX', { style: 'percent', maximumFractionDigits: 1 });
const nombreMes = new Intl.DateTimeFormat('es-MX', { month: 'short', year: 'numeric', timeZone: 'UTC' });
const fechaLarga = new Intl.DateTimeFormat('es-MX', { dateStyle: 'long', timeZone: 'America/Merida' });

const etiquetaMes = (mes: string) => nombreMes.format(new Date(`${mes}-01T00:00:00Z`)).replace('.', '');

const rango = computed(() => {
  if (!datos.value) return '';
  const { porMes, periodo } = datos.value;
  if (porMes.length === 0) return '';
  return `${etiquetaMes(porMes[0].mes)} – ${fechaLarga.format(new Date(periodo.fin))} (último movimiento registrado)`;
});

const variacion = computed(() => {
  const v = datos.value?.unidadesVendidas.variacion;
  if (v === null || v === undefined) return null;
  return { texto: porcentaje.format(Math.abs(v)), sube: v >= 0 };
});

const columnasReponer: Columna[] = [
  { key: 'nombre', label: 'Producto' },
  { key: 'categoria', label: 'Categoría' },
  { key: 'stock_actual', label: 'Stock actual', align: 'right', class: 'tabular-nums' },
  { key: 'stock_minimo', label: 'Stock mínimo', align: 'right', class: 'tabular-nums' },
  { key: 'faltante', label: 'Faltan', align: 'right' },
];
const columnasMes: Columna[] = [
  { key: 'mes', label: 'Mes' },
  { key: 'entradas', label: 'Entradas (unidades)', align: 'right', class: 'tabular-nums' },
  { key: 'salidas', label: 'Salidas (unidades)', align: 'right', class: 'tabular-nums' },
];
const columnasCategoria: Columna[] = [
  { key: 'categoria', label: 'Categoría' },
  { key: 'unidades', label: 'Unidades vendidas', align: 'right', class: 'tabular-nums' },
];
</script>

<template>
  <section>
    <PageHeader title="Dashboard" :subtitle="rango || 'Indicadores de inventario y ventas'">
      <template #actions>
        <FormField id="periodo" label="Periodo" class="w-52">
          <SelectInput id="periodo" v-model="meses" :options="opcionesPeriodo" />
        </FormField>
      </template>
    </PageHeader>

    <p v-if="error" class="mb-3 rounded-lg bg-error-10 p-3 text-sm text-error">{{ error }}</p>

    <div v-if="datos" class="space-y-4 py-3 transition-opacity" :class="{ 'opacity-60': cargando }">
      <!-- Indicadores -->
      <div class="grid gap-4 md:grid-cols-3">
        <StatCard
          label="Productos bajo su stock mínimo"
          :value="numero.format(datos.stockBajo.productos)"
          icon="inventory_2"
          :alert="datos.stockBajo.productos > 0"
        >
          de {{ numero.format(datos.stockBajo.total) }} productos activos · hay que reponerlos
        </StatCard>

        <StatCard label="Unidades vendidas en el periodo" :value="numero.format(datos.unidadesVendidas.actual)" icon="shopping_cart">
          <span v-if="variacion" class="flex items-center gap-1">
            <AppIcon :name="variacion.sube ? 'trending_up' : 'trending_down'" :size="18" />
            {{ variacion.texto }} {{ variacion.sube ? 'más' : 'menos' }} que los {{ meses }} meses anteriores
          </span>
          <span v-else>Sin periodo anterior completo para comparar</span>
        </StatCard>

        <StatCard label="Categoría más vendida" :value="datos.categoriaTop?.categoria ?? '—'" icon="category">
          <template v-if="datos.categoriaTop">
            {{ porcentaje.format(datos.categoriaTop.participacion) }} de las unidades vendidas
            ({{ numero.format(datos.categoriaTop.unidades) }})
          </template>
        </StatCard>
      </div>

      <!-- Gráficas -->
      <div class="grid gap-4 lg:grid-cols-2">
        <ChartCard title="Entradas y salidas por mes" subtitle="Unidades; el último mes está en curso">
          <LineChart
            :labels="datos.porMes.map((m) => etiquetaMes(m.mes))"
            :series="[
              { label: 'Salidas (ventas)', data: datos.porMes.map((m) => m.salidas), color: COLOR.azul },
              { label: 'Entradas (compras)', data: datos.porMes.map((m) => m.entradas), color: COLOR.naranja },
            ]"
            descripcion="Gráfica de línea con las unidades que entran y salen cada mes"
          />
          <template #table>
            <DataTable :columns="columnasMes" :rows="datos.porMes" row-key="mes">
              <template #cell-mes="{ row }">{{ etiquetaMes(row.mes) }}</template>
              <template #cell-entradas="{ row }">{{ numero.format(row.entradas) }}</template>
              <template #cell-salidas="{ row }">{{ numero.format(row.salidas) }}</template>
            </DataTable>
          </template>
        </ChartCard>

        <ChartCard title="Unidades vendidas por categoría" subtitle="Salidas del periodo, de mayor a menor">
          <BarChart
            :labels="datos.porCategoria.map((c) => c.categoria)"
            :data="datos.porCategoria.map((c) => c.unidades)"
            label="Unidades vendidas"
            descripcion="Gráfica de barras con las unidades vendidas por categoría"
          />
          <template #table>
            <DataTable :columns="columnasCategoria" :rows="datos.porCategoria" row-key="categoria">
              <template #cell-unidades="{ row }">{{ numero.format(row.unidades) }}</template>
            </DataTable>
          </template>
        </ChartCard>
      </div>

      <!-- Detalle del primer indicador -->
      <div>
        <h2 class="mb-3 text-base font-semibold text-texto">Productos por reponer</h2>
        <DataTable
          :columns="columnasReponer"
          :rows="datos.porReponer"
          row-key="id_producto"
          empty-text="Todos los productos están en o por encima de su stock mínimo."
        >
          <template #cell-nombre="{ row }"><span class="font-medium text-marino">{{ row.nombre }}</span></template>
          <template #cell-faltante="{ row }">
            <StatusBadge tone="error">{{ row.faltante }} {{ row.faltante === 1 ? 'unidad' : 'unidades' }}</StatusBadge>
          </template>
        </DataTable>
      </div>
    </div>
  </section>
</template>
