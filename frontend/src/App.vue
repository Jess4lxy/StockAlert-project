<script setup lang="ts">
import { ref } from 'vue';
import { AppShell, type ItemNavegacion } from '@/components/ui';
import MovimientosView from '@/views/MovimientosView.vue';

const secciones: ItemNavegacion[] = [{ id: 'movimientos', label: 'Movimientos', icon: 'swap_vert' }];
const activa = ref('movimientos');
</script>

<template>
  <AppShell v-model:active="activa" :items="secciones">
    <MovimientosView v-if="activa === 'movimientos'" />
  </AppShell>
</template>
