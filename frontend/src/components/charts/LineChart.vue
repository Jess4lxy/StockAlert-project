<script setup lang="ts">
// Gráfica de línea para series en el tiempo (misma unidad, un solo eje).
import { computed, onMounted, ref } from 'vue';
import { Line } from 'vue-chartjs';
import type { ChartData, ChartOptions } from 'chart.js';
import { COLOR, compacto, lineaGuia, numero, tooltipBase, type SerieLinea } from './tema';

const props = defineProps<{ labels: string[]; series: SerieLinea[]; descripcion: string }>();

const datos = computed<ChartData<'line'>>(() => ({
  labels: props.labels,
  datasets: props.series.map((s) => ({
    label: s.label,
    data: s.data,
    borderColor: s.color,
    backgroundColor: s.color,
    borderWidth: 2,
    borderCapStyle: 'round',
    borderJoinStyle: 'round',
    pointRadius: 4,
    pointHoverRadius: 6,
    pointBackgroundColor: s.color,
    pointBorderColor: '#ffffff',
    pointBorderWidth: 2,
    pointHitRadius: 12,
  })),
}));

const opciones: ChartOptions<'line'> = {
  responsive: true,
  maintainAspectRatio: false,
  interaction: { mode: 'index', intersect: false },
  plugins: {
    // La leyenda va en HTML (arriba de la gráfica) con una línea corta por serie
    legend: { display: false },
    tooltip: {
      ...tooltipBase,
      callbacks: {
        label: (c) => ` ${numero.format(c.parsed.y ?? 0)} · ${c.dataset.label}`,
        labelPointStyle: () => ({ pointStyle: 'line', rotation: 0 }),
        labelColor: (c) => ({
          borderColor: c.dataset.borderColor as string,
          backgroundColor: c.dataset.borderColor as string,
          borderWidth: 2,
        }),
      },
    },
  },
  scales: {
    x: { grid: { display: false }, border: { color: COLOR.eje }, ticks: { maxRotation: 0, autoSkipPadding: 12 } },
    y: {
      beginAtZero: true,
      grid: { color: COLOR.rejilla },
      border: { display: false },
      ticks: { callback: (v) => compacto.format(Number(v)), maxTicksLimit: 6 },
    },
  },
};

const fuentesListas = ref(false);
onMounted(async () => {
  await document.fonts.ready;
  fuentesListas.value = true;
});
</script>

<template>
  <ul class="mb-3 flex flex-wrap gap-x-5 gap-y-1 text-xs font-medium text-texto">
    <li v-for="s in series" :key="s.label" class="flex items-center gap-2">
      <span class="h-0.5 w-4 rounded-full" :style="{ backgroundColor: s.color }" aria-hidden="true" />
      {{ s.label }}
    </li>
  </ul>
  <div class="relative h-64">
    <Line v-if="fuentesListas" :data="datos" :options="opciones" :plugins="[lineaGuia]" role="img" :aria-label="descripcion" />
  </div>
</template>
