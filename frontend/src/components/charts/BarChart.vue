<script setup lang="ts">
// Barras horizontales de una sola serie, ordenadas por valor, con el valor en la punta.
import { computed, onMounted, ref } from 'vue';
import { Bar } from 'vue-chartjs';
import type { ChartData, ChartOptions } from 'chart.js';
import { COLOR, compacto, numero, tooltipBase, valorEnBarra } from './tema';

const props = withDefaults(
  defineProps<{ labels: string[]; data: number[]; label: string; color?: string; descripcion: string }>(),
  { color: COLOR.azul },
);

const datos = computed<ChartData<'bar'>>(() => ({
  labels: props.labels,
  datasets: [
    {
      label: props.label,
      data: props.data,
      backgroundColor: props.color,
      hoverBackgroundColor: '#5a97e0',
      maxBarThickness: 24,
      borderRadius: 4,
      borderSkipped: 'start',
    },
  ],
}));

const opciones = computed<ChartOptions<'bar'>>(() => ({
  indexAxis: 'y',
  responsive: true,
  maintainAspectRatio: false,
  // Toda la franja de la categoría responde al puntero, no solo la barra
  interaction: { mode: 'index', axis: 'y', intersect: false },
  layout: { padding: { right: 48 } },
  plugins: {
    legend: { display: false },
    tooltip: {
      ...tooltipBase,
      callbacks: { label: (c) => ` ${numero.format(c.parsed.x ?? 0)} ${props.label.toLowerCase()}` },
    },
  },
  scales: {
    x: {
      beginAtZero: true,
      grid: { color: COLOR.rejilla },
      border: { display: false },
      ticks: { callback: (v) => compacto.format(Number(v)), maxTicksLimit: 6 },
    },
    y: { grid: { display: false }, border: { color: COLOR.eje }, ticks: { color: COLOR.texto } },
  },
}));

const fuentesListas = ref(false);
onMounted(async () => {
  await document.fonts.ready;
  fuentesListas.value = true;
});
</script>

<template>
  <div class="relative h-72">
    <Bar v-if="fuentesListas" :data="datos" :options="opciones" :plugins="[valorEnBarra]" role="img" :aria-label="descripcion" />
  </div>
</template>
