<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref } from 'vue';
import PwaAvisos from '@/components/PwaAvisos.vue';
import { AppShell, type ItemNavegacion } from '@/components/ui';
import AlertasView from '@/views/AlertasView.vue';
import DashboardView from '@/views/DashboardView.vue';
import MovimientosView from '@/views/MovimientosView.vue';
import ProductosView from '@/views/ProductosView.vue';

const secciones: ItemNavegacion[] = [
  { id: 'dashboard', label: 'Dashboard', icon: 'space_dashboard' },
  { id: 'productos', label: 'Productos', icon: 'inventory_2' },
  { id: 'movimientos', label: 'Movimientos', icon: 'swap_vert' },
  { id: 'alertas', label: 'Alertas', icon: 'notifications' },
];

// La sección activa vive en el hash (#/productos): se puede recargar, compartir
// o abrir desde los accesos directos del icono instalado.
const idsValidos = secciones.map((s) => s.id);
const desdeHash = () => {
  const id = window.location.hash.replace(/^#\/?/, '');
  return idsValidos.includes(id) ? id : 'dashboard';
};

const activa = ref(desdeHash());

const alCambiarHash = () => (activa.value = desdeHash());
onMounted(() => window.addEventListener('hashchange', alCambiarHash));
onBeforeUnmount(() => window.removeEventListener('hashchange', alCambiarHash));

function cambiar(id: string) {
  activa.value = id;
  window.location.hash = `/${id}`;
  window.scrollTo({ top: 0 });
}
</script>

<template>
  <AppShell :active="activa" :items="secciones" @update:active="cambiar">
    <DashboardView v-if="activa === 'dashboard'" />
    <ProductosView v-else-if="activa === 'productos'" />
    <MovimientosView v-else-if="activa === 'movimientos'" />
    <AlertasView v-else-if="activa === 'alertas'" />
  </AppShell>
  <PwaAvisos />
</template>
