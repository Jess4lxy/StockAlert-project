<script setup lang="ts">
import { onMounted, reactive, ref, watch } from 'vue';
import { api, type Movimiento, type Pagina } from '../api';
import Paginacion from './Paginacion.vue';

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

const fecha = new Intl.DateTimeFormat('es-MX', {
  timeZone: 'America/Merida',
  dateStyle: 'medium',
  timeStyle: 'short',
});

const ESTILO_TIPO: Record<string, string> = {
  entrada: 'bg-emerald-100 text-emerald-800',
  salida: 'bg-sky-100 text-sky-800',
  ajuste: 'bg-amber-100 text-amber-800',
};

// Las salidas restan y los ajustes pueden sumar o restar
function cantidad(m: Movimiento): string {
  if (m.tipo_movimiento === 'salida') return `−${m.cantidad}`;
  if (m.tipo_movimiento === 'ajuste') return m.cantidad > 0 ? `+${m.cantidad}` : `−${-m.cantidad}`;
  return `+${m.cantidad}`;
}
</script>

<template>
  <section class="space-y-4">
    <div>
      <h1 class="text-2xl font-bold text-marino">Movimientos de inventario</h1>
      <p class="text-sm text-slate-600">Entradas, salidas y ajustes registrados en el almacén.</p>
    </div>

    <form
      class="grid gap-3 rounded-lg border border-slate-200 bg-white p-4 sm:grid-cols-2 lg:grid-cols-[2fr_1fr_1fr_auto_auto]"
      @submit.prevent
    >
      <label class="flex flex-col gap-1 text-sm">
        <span class="font-medium">Buscar producto</span>
        <input v-model="filtros.q" type="search" placeholder="Ej. cuaderno, pilas, cloro…" class="campo" />
      </label>
      <label class="flex flex-col gap-1 text-sm">
        <span class="font-medium">Tipo</span>
        <select v-model="filtros.tipo" class="campo">
          <option value="">Todos</option>
          <option value="entrada">Entrada</option>
          <option value="salida">Salida</option>
          <option value="ajuste">Ajuste</option>
        </select>
      </label>
      <label class="flex flex-col gap-1 text-sm">
        <span class="font-medium">Categoría</span>
        <select v-model="filtros.categoria" class="campo">
          <option value="">Todas</option>
          <option v-for="c in categorias" :key="c" :value="c">{{ c }}</option>
        </select>
      </label>
      <label class="flex flex-col gap-1 text-sm">
        <span class="font-medium">Por página</span>
        <select v-model.number="filtros.limit" class="campo">
          <option v-for="n in [10, 20, 50, 100]" :key="n" :value="n">{{ n }}</option>
        </select>
      </label>
      <button
        type="button"
        class="self-end rounded-md border border-slate-300 px-3 py-2 text-sm hover:bg-slate-100"
        @click="limpiar"
      >
        Limpiar
      </button>
    </form>

    <p v-if="error" class="rounded-md bg-red-50 p-3 text-sm text-red-700">{{ error }}</p>

    <div class="overflow-x-auto rounded-lg border border-slate-200 bg-white" :class="{ 'opacity-60': cargando }">
      <table class="w-full text-left text-sm">
        <thead class="bg-marino text-white">
          <tr>
            <th class="px-3 py-2 font-semibold">Folio</th>
            <th class="px-3 py-2 font-semibold">Fecha</th>
            <th class="px-3 py-2 font-semibold">Producto</th>
            <th class="px-3 py-2 font-semibold">Categoría</th>
            <th class="px-3 py-2 font-semibold">Tipo</th>
            <th class="px-3 py-2 text-right font-semibold">Cantidad</th>
            <th class="px-3 py-2 font-semibold">Usuario</th>
            <th class="px-3 py-2 font-semibold">Observaciones</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="m in resultado?.data" :key="m.id_movimiento" class="border-t border-slate-100 even:bg-slate-50">
            <td class="px-3 py-2 font-mono text-xs text-slate-500">MOV-{{ String(m.id_movimiento).padStart(6, '0') }}</td>
            <td class="px-3 py-2 whitespace-nowrap">{{ fecha.format(new Date(m.fecha_movimiento)) }}</td>
            <td class="px-3 py-2">{{ m.producto }}</td>
            <td class="px-3 py-2 text-slate-600">{{ m.categoria }}</td>
            <td class="px-3 py-2">
              <span class="rounded-full px-2 py-0.5 text-xs font-medium capitalize" :class="ESTILO_TIPO[m.tipo_movimiento]">
                {{ m.tipo_movimiento }}
              </span>
            </td>
            <td class="px-3 py-2 text-right tabular-nums">{{ cantidad(m) }}</td>
            <td class="px-3 py-2 whitespace-nowrap">{{ m.usuario }}</td>
            <td class="px-3 py-2 text-slate-500">{{ m.observaciones ?? '—' }}</td>
          </tr>
          <tr v-if="resultado && resultado.data.length === 0">
            <td colspan="8" class="px-3 py-8 text-center text-slate-500">No hay movimientos con esos filtros.</td>
          </tr>
        </tbody>
      </table>
    </div>

    <Paginacion
      v-if="resultado"
      :page="resultado.page"
      :total-pages="resultado.totalPages"
      :total="resultado.total"
      :limit="resultado.limit"
      @cambiar="(p) => (filtros.page = p)"
    />
  </section>
</template>

<style scoped>
@reference "../style.css";

.campo {
  @apply rounded-md border border-slate-300 bg-white px-3 py-2 focus:border-marino focus:ring-2 focus:ring-marino/20 focus:outline-none;
}
</style>
