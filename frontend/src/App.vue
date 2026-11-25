<script setup lang="ts">
import { computed, defineAsyncComponent, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import PwaAvisos from '@/components/PwaAvisos.vue';
import ColaDialog from '@/components/inventario/ColaDialog.vue';
import { AppIcon, AppShell, BaseButton, BaseDialog, type ItemNavegacion } from '@/components/ui';
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

const { usuario, token, cerrarSesion, revisarSesion } = useSesion();
const { cola, pendientes, rechazadas, sincronizando } = useInventario();
const verCola = ref(false);
const confirmarSalida = ref(false);

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

// Cuando la sesión obtiene su token (al entrar, al cambiar de cuenta o al abrir la app)
// se guarda la vista inicial de cada sección para usarla sin conexión. No se repite en
// cada renovación del token. La plataforma no tiene inventario que guardar.
watch(
  [() => usuario.value?.id_usuario, () => !!token.value] as const,
  ([id, conToken]) => {
    if (id && conToken && usuario.value?.empresa) guardarDatosSinConexion();
  },
  { immediate: true },
);

// El inventario del dispositivo es del usuario con sesión. Se abre aunque no haya token
// (sin conexión) y se sincroniza en cuanto lo hay.
watch(
  [() => (usuario.value?.empresa ? usuario.value.id_usuario : null), () => !!token.value] as const,
  async ([id, conToken]) => {
    await usarInventarioDe(id);
    if (!id || !conToken) return;
    await sincronizar();
    void revisarAlertas(id).catch(() => {});
  },
  { immediate: true },
);
alGenerarAlerta((alerta, nombre) => {
  if (usuario.value) void notificarAlerta(usuario.value.id_usuario, alerta, nombre);
});

// Alertas que generó otra persona: cada 5 minutos y al volver a la app
const buscarAlertas = () => {
  if (usuario.value?.empresa && token.value) void revisarAlertas(usuario.value.id_usuario).catch(() => {});
};
const alVolver = () => document.visibilityState === 'visible' && buscarAlertas();
const reloj = setInterval(buscarAlertas, 5 * 60_000);
document.addEventListener('visibilitychange', alVolver);
onBeforeUnmount(() => {
  clearInterval(reloj);
  document.removeEventListener('visibilitychange', alVolver);
});

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

  <AppShell v-else :active="activa" :items="secciones" :usuario="datosUsuario" @update:active="ir" @salir="pedirSalida">
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
    <!-- :key reinicia la pantalla al cambiar de cuenta, para no mostrar datos de la anterior -->
    <div :key="usuario.id_usuario">
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
  <PwaAvisos />
</template>
