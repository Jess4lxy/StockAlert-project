<script setup lang="ts">
import { ref } from 'vue';
import { AppShell, type ItemNavegacion } from '@/components/ui';
import DashboardView from '@/views/DashboardView.vue';
import MovimientosView from '@/views/MovimientosView.vue';

const secciones: ItemNavegacion[] = [
  { id: 'dashboard', label: 'Dashboard', icon: 'space_dashboard' },
  { id: 'movimientos', label: 'Movimientos', icon: 'swap_vert' },
];
const activa = ref('dashboard');
</script>

<template>
  <AppShell v-model:active="activa" :items="secciones">
    <DashboardView v-if="activa === 'dashboard'" />
    <MovimientosView v-else-if="activa === 'movimientos'" />
  </AppShell>
</template>
