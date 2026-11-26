<script setup lang="ts">
import { computed, defineAsyncComponent, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import PwaAvisos from '@/components/PwaAvisos.vue';
import ColaDialog from '@/components/inventario/ColaDialog.vue';
import { mensajeDeError } from '@/api';
import { AppIcon, AppShell, BaseButton, BaseDialog, type ItemNavegacion, type Opcion } from '@/components/ui';
import { claveInventario } from '@/datos/bd';
import { alGenerarAlerta, sincronizar, usarInventarioDe, useInventario } from '@/datos/inventario';
import { notificarAlerta, revisarAlertas } from '@/dispositivo/notificaciones';
import { guardarDatosSinConexion } from '@/pwa/usePwa';
import { useSesion } from '@/sesion';
import AlertasView from '@/views/AlertasView.vue';
import EmpresasView from '@/views/EmpresasView.vue';
import LoginView from '@/views/LoginView.vue';
import MovimientosView from '@/views/MovimientosView.vue';
import ProductosView from '@/views/ProductosView.vue';
import RegistroView from '@/views/RegistroView.vue';
import UsuariosView from '@/views/UsuariosView.vue';

// Las gráficas (Chart.js) van en su propio archivo: el inicio de sesión no las descarga
const DashboardView = defineAsyncComponent(() => import('@/views/DashboardView.vue'));

const { usuario, token, cambiarEmpresa, cerrarSesion, revisarSesion } = useSesion();
const inventario = computed(() => claveInventario(usuario.value));
const { cola, pendientes, rechazadas, sincronizando } = useInventario();
const verCola = ref(false);
const confirmarSalida = ref(false);
const errorEmpresa = ref('');

const INVENTARIO: ItemNavegacion[] = [
  { id: 'dashboard', label: 'Dashboard', icon: 'space_dashboard' },
  { id: 'productos', label: 'Productos', icon: 'inventory_2' },
  { id: 'movimientos', label: 'Movimientos', icon: 'swap_vert' },
  { id: 'alertas', label: 'Alertas', icon: 'notifications' },
];
const USUARIOS: ItemNavegacion = { id: 'usuarios', label: 'Usuarios', icon: 'group' };
const EMPRESAS: ItemNavegacion = { id: 'empresas', label: 'Empresas', icon: 'business' };

// Cada rol ve sus secciones: la plataforma administra empresas y usuarios; el admin de
// una empresa ve su inventario y a su equipo; almacén, solo el inventario.
const secciones = computed<ItemNavegacion[]>(() => {
  switch (usuario.value?.rol) {
    case 'plataforma':
      return [EMPRESAS, USUARIOS];
    case 'admin':
      return [...INVENTARIO, USUARIOS];
    case 'almacen':
      return INVENTARIO;
    default:
      return [];
  }
});

const ETIQUETA_ROL = { plataforma: 'Administración de la plataforma', admin: 'Administrador', almacen: 'Almacén' };
const datosUsuario = computed(() =>
  usuario.value
    ? { nombre: usuario.value.nombre, detalle: usuario.value.empresa?.nombre ?? ETIQUETA_ROL[usuario.value.rol] }
    : undefined,
);

// La sección activa vive en el hash (#/productos): se puede recargar, compartir
// o abrir desde los accesos directos del icono instalado.
const hash = ref(window.location.hash);
const ruta = computed(() => hash.value.replace(/^#\/?/, '').split('?')[0]);
const activa = computed(() => {
  const ids = secciones.value.map((s) => s.id);
  return ids.includes(ruta.value) ? ruta.value : (ids[0] ?? '');
});
// Filtro de empresa al pasar de Empresas a Usuarios (#/usuarios?empresa=3)
const empresaFiltro = computed(() => {
  const id = Number(new URLSearchParams(hash.value.split('?')[1] ?? '').get('empresa'));
  return Number.isInteger(id) && id > 0 ? id : undefined;
});

const alCambiarHash = () => (hash.value = window.location.hash);
onMounted(() => {
  window.addEventListener('hashchange', alCambiarHash);
  void revisarSesion();
});
onBeforeUnmount(() => window.removeEventListener('hashchange', alCambiarHash));

function ir(destino: string) {
  window.location.hash = `/${destino}`;
  hash.value = window.location.hash;
  window.scrollTo({ top: 0 });
}

// Cuando la sesión obtiene su token (al entrar, al cambiar de empresa o al abrir la app)
// se guarda la vista inicial de cada sección para usarla sin conexión. No se repite en
// cada renovación del token. La plataforma no tiene inventario que guardar.
watch(
  [inventario, () => !!token.value] as const,
  ([clave, conToken]) => {
    if (clave && conToken) guardarDatosSinConexion();
  },
  { immediate: true },
);

// El inventario del dispositivo es del usuario con sesión en la empresa abierta. Se abre aunque
// no haya token (sin conexión) y se sincroniza en cuanto lo hay. flush: 'sync' para que cambie
// de base en el mismo momento que la sesión, sin dejar un hueco en el que se mezclen empresas.
watch(
  [inventario, () => !!token.value] as const,
  async ([clave, conToken]) => {
    await usarInventarioDe(clave);
    if (!clave || !conToken || inventario.value !== clave) return;
    await sincronizar();
    void revisarAlertas(clave).catch(() => {});
  },
  { immediate: true, flush: 'sync' },
);
alGenerarAlerta((alerta, nombre) => {
  if (inventario.value) void notificarAlerta(inventario.value, alerta, nombre);
});

// Alertas que generó otra persona: cada 5 minutos y al volver a la app
const buscarAlertas = () => {
  if (inventario.value && token.value) void revisarAlertas(inventario.value).catch(() => {});
};
const alVolver = () => document.visibilityState === 'visible' && buscarAlertas();
const reloj = setInterval(buscarAlertas, 5 * 60_000);
document.addEventListener('visibilitychange', alVolver);
onBeforeUnmount(() => {
  clearInterval(reloj);
  document.removeEventListener('visibilitychange', alVolver);
});

// --- Cambio de empresa ----------------------------------------------------------
// El selector aparece si hay a dónde cambiar. 0 = administración de la plataforma.
const empresas = computed<Opcion<number>[]>(() => {
  const lista = (usuario.value?.empresas ?? []).map((e) => ({ value: e.id_empresa, label: e.nombre }));
  return usuario.value?.plataforma ? [{ value: 0, label: 'Administración de la plataforma' }, ...lista] : lista;
});
const empresaAbierta = computed(() => usuario.value?.empresa?.id_empresa ?? 0);
const cambiando = ref(false);
const porCambiar = ref<number | null>(null);

async function elegirEmpresa(id: number) {
  if (id === empresaAbierta.value || cambiando.value) return;
  errorEmpresa.value = '';
  if (!navigator.onLine) {
    errorEmpresa.value = 'Para cambiar de empresa necesitas conexión a Internet.';
    return;
  }
  if (pendientes.value.length) await sincronizar();
  if (cola.value.length) porCambiar.value = id;
  else await abrirEmpresa(id);
}

async function abrirEmpresa(id: number) {
  porCambiar.value = null;
  cambiando.value = true;
  try {
    await cambiarEmpresa(id || null);
    ir(secciones.value[0]?.id ?? '');
  } catch (e) {
    errorEmpresa.value = mensajeDeError(e);
  } finally {
    cambiando.value = false;
  }
}

// Con operaciones por enviar se avisa antes de cerrar sesión
async function pedirSalida() {
  if (pendientes.value.length) await sincronizar();
  if (cola.value.length) confirmarSalida.value = true;
  else await salir();
}

async function salir() {
  confirmarSalida.value = false;
  await cerrarSesion();
  ir('login');
}
</script>

<template>
  <template v-if="!usuario">
    <RegistroView v-if="ruta === 'registro'" />
    <LoginView v-else />
  </template>

  <AppShell
    v-else
    :active="activa"
    :items="secciones"
    :usuario="datosUsuario"
    :empresas="empresas"
    :empresa="empresaAbierta"
    :cambiando="cambiando"
    @update:active="ir"
    @empresa="elegirEmpresa"
    @salir="pedirSalida"
  >
    <template #estado>
      <button
        v-if="cola.length"
        type="button"
        class="inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold"
        :class="rechazadas.length ? 'bg-error-10 text-error' : 'bg-alerta-10 text-alerta'"
        @click="verCola = true"
      >
        <AppIcon name="sync" :size="16" :class="{ 'animate-spin': sincronizando }" />
        {{ rechazadas.length ? `${rechazadas.length} por revisar` : `${pendientes.length} por enviar` }}
      </button>
    </template>
    <p v-if="errorEmpresa" class="mb-3 flex items-center justify-between gap-3 rounded-lg bg-error-10 p-3 text-sm text-error" role="alert">
      {{ errorEmpresa }}
      <button type="button" class="font-semibold" @click="errorEmpresa = ''">Cerrar</button>
    </p>
    <!-- :key reinicia la pantalla al cambiar de cuenta o de empresa, para no mostrar datos de la anterior -->
    <div :key="`${usuario.id_usuario}-${empresaAbierta}`">
      <EmpresasView v-if="activa === 'empresas'" @ver-usuarios="(id) => ir(`usuarios?empresa=${id}`)" />
      <UsuariosView v-else-if="activa === 'usuarios'" :empresa-inicial="empresaFiltro" />
      <DashboardView v-else-if="activa === 'dashboard'" />
      <ProductosView v-else-if="activa === 'productos'" />
      <MovimientosView v-else-if="activa === 'movimientos'" />
      <AlertasView v-else-if="activa === 'alertas'" />
    </div>
  </AppShell>

  <ColaDialog v-model:open="verCola" />
  <BaseDialog v-model:open="confirmarSalida" title="Tienes cambios sin enviar">
    <p class="text-sm text-texto">
      {{ cola.length === 1 ? 'Queda 1 operación' : `Quedan ${cola.length} operaciones` }} en este dispositivo. Se conservan y se enviarán cuando vuelvas a iniciar sesión aquí con esta cuenta.
    </p>
    <template #acciones>
      <BaseButton variant="outline" @click="confirmarSalida = false">Quedarme</BaseButton>
      <BaseButton @click="salir">Cerrar sesión</BaseButton>
    </template>
  </BaseDialog>
  <BaseDialog :open="porCambiar !== null" title="Tienes cambios sin enviar" @update:open="(abierto) => !abierto && (porCambiar = null)">
    <p class="text-sm text-texto">
      {{ cola.length === 1 ? 'Queda 1 operación' : `Quedan ${cola.length} operaciones` }} de {{ usuario?.empresa?.nombre }} en este dispositivo. Se conservan y se enviarán cuando vuelvas a esta empresa.
    </p>
    <template #acciones>
      <BaseButton variant="outline" @click="porCambiar = null">Quedarme</BaseButton>
      <BaseButton @click="porCambiar !== null && abrirEmpresa(porCambiar)">Cambiar de empresa</BaseButton>
    </template>
  </BaseDialog>
  <PwaAvisos />
</template>
