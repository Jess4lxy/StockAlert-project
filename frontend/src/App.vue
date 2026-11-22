<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import PwaAvisos from '@/components/PwaAvisos.vue';
import { AppShell, type ItemNavegacion } from '@/components/ui';
import { guardarDatosSinConexion } from '@/pwa/usePwa';
import { useSesion } from '@/sesion';
import AlertasView from '@/views/AlertasView.vue';
import DashboardView from '@/views/DashboardView.vue';
import EmpresasView from '@/views/EmpresasView.vue';
import LoginView from '@/views/LoginView.vue';
import MovimientosView from '@/views/MovimientosView.vue';
import ProductosView from '@/views/ProductosView.vue';
import RegistroView from '@/views/RegistroView.vue';
import UsuariosView from '@/views/UsuariosView.vue';

const { usuario, token, cerrarSesion, revisarSesion } = useSesion();

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
  () => [usuario.value?.id_usuario, !!token.value] as const,
  ([id, conToken]) => {
    if (id && conToken && usuario.value?.empresa) guardarDatosSinConexion();
  },
  { immediate: true },
);

async function salir() {
  await cerrarSesion();
  ir('login');
}
</script>

<template>
  <template v-if="!usuario">
    <RegistroView v-if="ruta === 'registro'" />
    <LoginView v-else />
  </template>

  <AppShell v-else :active="activa" :items="secciones" :usuario="datosUsuario" @update:active="ir" @salir="salir">
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
  <PwaAvisos />
</template>
