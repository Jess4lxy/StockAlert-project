<script setup lang="ts">
import { computed, onMounted, reactive, ref, watch } from 'vue';
import { api, mensajeDeError, type EstadoStock, type Pagina } from '@/api';
import EscanerDialog from '@/components/inventario/EscanerDialog.vue';
import FotoProducto from '@/components/inventario/FotoProducto.vue';
import MovimientoDialog from '@/components/inventario/MovimientoDialog.vue';
import ProductoDialog from '@/components/inventario/ProductoDialog.vue';
import {
  BaseButton,
  BaseDialog,
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
import { claveInventario } from '@/datos/bd';
import { buscarProductos, categoriasLocales, ejecutar, productoPorCodigo, useInventario, type ProductoLocal, type Resultado } from '@/datos/inventario';
import { notificarAlerta } from '@/dispositivo/notificaciones';
import { useSesion } from '@/sesion';

const { usuario } = useSesion();
const { version } = useInventario();
const esAdmin = computed(() => usuario.value?.rol === 'admin');

const filtros = reactive({ q: '', estado: '', categoria: '', activo: 'true' as 'true' | 'false', page: 1, limit: 20 });
const resultado = ref<Pagina<ProductoLocal> | null>(null);
// Los datos salen del dispositivo: no hay conexión o quedan cambios por enviar
const local = ref(false);
const exito = ref('');
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
    const r = await buscarProductos({ ...filtros }, controlador.signal);
    resultado.value = r.pagina;
    local.value = r.local;
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
watch(() => [filtros.estado, filtros.categoria, filtros.activo, filtros.limit], reiniciar);
watch(() => filtros.page, cargar);
// Se registró algo o terminó una sincronización
watch(version, () => {
  cargar();
  cargarCategorias();
});

async function cargarCategorias() {
  categorias.value = await api.categorias().catch(() => categoriasLocales()).catch(() => []);
}
onMounted(() => {
  cargar();
  cargarCategorias();
});

// --- Altas, cambios y movimientos -------------------------------------------------
const dialogoProducto = ref(false);
const dialogoMovimiento = ref(false);
const dialogoEstado = ref(false);
const escaner = ref(false);
const elegido = ref<ProductoLocal | null>(null);
const codigoNuevo = ref('');
const guardando = ref(false);
const errorEstado = ref('');

function avisar(nombre: string, accion: string, r: Resultado) {
  exito.value = r.enviada ? `${nombre}: ${accion}.` : `${nombre}: guardado en el dispositivo; se enviará al volver la conexión.`;
  setTimeout(() => (exito.value = ''), 5000);
  const clave = claveInventario(usuario.value);
  if (r.alerta && clave) void notificarAlerta(clave, r.alerta, nombre);
}

function editar(p: ProductoLocal | null, codigo = '') {
  elegido.value = p;
  codigoNuevo.value = codigo;
  dialogoProducto.value = true;
}
function mover(p: ProductoLocal) {
  elegido.value = p;
  dialogoMovimiento.value = true;
}
function pedirEstado(p: ProductoLocal) {
  elegido.value = p;
  errorEstado.value = '';
  dialogoEstado.value = true;
}

async function cambiarEstado() {
  const p = elegido.value!;
  guardando.value = true;
  try {
    const r = await ejecutar({
      tipo: 'estado_producto',
      producto: { id: p.id_producto || null, local: p.id_producto ? null : p.clave.replace('local-', '') },
      nombreProducto: p.nombre,
      activo: !p.estado,
    });
    dialogoEstado.value = false;
    avisar(p.nombre, p.estado ? 'desactivado' : 'activado', r);
  } catch (e) {
    errorEstado.value = mensajeDeError(e);
  } finally {
    guardando.value = false;
  }
}

// Escanear en esta pantalla: si el código existe se registra su movimiento; si no, un
// administrador puede darlo de alta con ese código
async function alEscanear(codigo: string) {
  const p = await productoPorCodigo(codigo).catch(() => null);
  if (p) return mover(p);
  if (esAdmin.value) return editar(null, codigo);
  error.value = `Ningún producto activo tiene el código ${codigo}. Pide a un administrador que lo registre.`;
}

function limpiar() {
  Object.assign(filtros, { q: '', estado: '', categoria: '', activo: 'true' });
}

const opcionesEstado = [
  { value: '', label: 'Todos' },
  { value: 'reponer', label: 'Por reponer (bajo o agotado)' },
  { value: 'bajo', label: 'Bajo su mínimo' },
  { value: 'agotado', label: 'Agotado' },
  { value: 'ok', label: 'En orden' },
];
const opcionesActivo = [
  { value: 'true' as const, label: 'Activos' },
  { value: 'false' as const, label: 'Desactivados' },
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
  { key: 'acciones', label: 'Acciones', align: 'right' },
];

const TONO: Record<EstadoStock, Tono> = { ok: 'exito', bajo: 'alerta', agotado: 'error' };
const ETIQUETA: Record<EstadoStock, string> = { ok: 'En orden', bajo: 'Bajo mínimo', agotado: 'Agotado' };

const moneda = new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' });
</script>

<template>
  <section>
    <PageHeader title="Productos" subtitle="Catálogo con el stock actual de cada producto frente a su mínimo.">
      <template #actions>
        <BaseButton variant="outline" icon="barcode" @click="escaner = true">Escanear</BaseButton>
        <BaseButton v-if="esAdmin" icon="add" @click="editar(null)">Nuevo producto</BaseButton>
      </template>
    </PageHeader>

    <FilterBar :columns="4">
      <FormField id="buscar-producto" label="Producto">
        <TextInput id="buscar-producto" v-model="filtros.q" type="search" icon="search" placeholder="Ej. cuaderno, pilas, cloro…" />
      </FormField>
      <FormField id="estado-stock" label="Estado del stock">
        <SelectInput id="estado-stock" v-model="filtros.estado" :options="opcionesEstado" />
      </FormField>
      <FormField id="categoria-producto" label="Categoría">
        <SelectInput id="categoria-producto" v-model="filtros.categoria" :options="opcionesCategoria" />
      </FormField>
      <FormField id="producto-activo" label="Mostrar">
        <SelectInput id="producto-activo" v-model="filtros.activo" :options="opcionesActivo" />
      </FormField>
      <template #actions>
        <BaseButton variant="outline" icon="filter_alt_off" @click="limpiar">Limpiar</BaseButton>
      </template>
    </FilterBar>

    <p v-if="exito" class="mb-3 rounded-lg bg-exito-10 p-3 text-sm text-exito" role="status">{{ exito }}</p>
    <p v-if="error" class="mb-3 rounded-lg bg-error-10 p-3 text-sm text-error" role="alert">{{ error }}</p>
    <p v-if="local && !error" class="mb-3 rounded-lg bg-alerta-10 p-3 text-sm text-texto" role="status">
      Inventario guardado en este dispositivo, con tus cambios por enviar incluidos.
    </p>

    <DataTable
      :columns="columnas"
      :rows="resultado?.data ?? []"
      row-key="clave"
      :loading="cargando"
      empty-text="No hay productos con esos filtros."
    >
      <template #cell-nombre="{ row }">
        <div class="flex items-center gap-3">
          <FotoProducto :producto="row" />
          <div class="min-w-0">
            <p class="font-medium text-marino">{{ row.nombre }}</p>
            <p v-if="row.codigo_barras" class="font-mono text-xs text-texto-suave">{{ row.codigo_barras }}</p>
            <StatusBadge v-if="row.pendiente" tone="alerta">Por enviar</StatusBadge>
          </div>
        </div>
      </template>
      <template #cell-precio="{ row }">{{ moneda.format(row.precio) }}</template>
      <template #cell-estado_stock="{ row }">
        <StatusBadge :tone="TONO[row.estado_stock]">{{ ETIQUETA[row.estado_stock] }}</StatusBadge>
      </template>
      <template #cell-acciones="{ row }">
        <div class="flex flex-wrap gap-1 md:justify-end">
          <BaseButton v-if="row.estado" variant="ghost" icon="swap_vert" class="!h-9 !px-2 !text-sm" :aria-label="`Registrar movimiento de ${row.nombre}`" @click="mover(row)">Mover</BaseButton>
          <template v-if="esAdmin">
            <BaseButton variant="ghost" icon="edit" class="!h-9 !px-2 !text-sm" :aria-label="`Editar ${row.nombre}`" @click="editar(row)">Editar</BaseButton>
            <BaseButton variant="ghost" class="!h-9 !px-2 !text-sm" :aria-label="`${row.estado ? 'Desactivar' : 'Activar'} ${row.nombre}`" @click="pedirEstado(row)">{{ row.estado ? 'Desactivar' : 'Activar' }}</BaseButton>
          </template>
        </div>
      </template>
    </DataTable>

    <TablePagination
      v-if="resultado"
      v-model:page="filtros.page"
      v-model:limit="filtros.limit"
      :total="resultado.total"
      class="mt-2"
    />

    <ProductoDialog v-model:open="dialogoProducto" :producto="elegido" :codigo="codigoNuevo" @guardado="(n, r) => avisar(n, 'guardado', r)" />
    <MovimientoDialog v-model:open="dialogoMovimiento" :producto="elegido" @guardado="(n, r) => avisar(n, 'movimiento registrado', r)" />
    <EscanerDialog v-model:open="escaner" @leido="alEscanear" />

    <BaseDialog v-model:open="dialogoEstado" :title="elegido?.estado ? 'Desactivar producto' : 'Activar producto'">
      <p class="text-sm text-texto">
        <template v-if="elegido?.estado"><strong>{{ elegido?.nombre }}</strong> dejará de aparecer y no admitirá movimientos. Su historial se conserva y puedes activarlo de nuevo.</template>
        <template v-else><strong>{{ elegido?.nombre }}</strong> volverá a aparecer y a admitir movimientos.</template>
      </p>
      <p v-if="errorEstado" class="mt-3 rounded-lg bg-error-10 p-3 text-sm text-error" role="alert">{{ errorEstado }}</p>
      <template #acciones>
        <BaseButton variant="outline" @click="dialogoEstado = false">Cancelar</BaseButton>
        <BaseButton :loading="guardando" @click="cambiarEstado">{{ elegido?.estado ? 'Desactivar' : 'Activar' }}</BaseButton>
      </template>
    </BaseDialog>
  </section>
</template>
