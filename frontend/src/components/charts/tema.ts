// Configuración compartida de Chart.js para que todas las gráficas se vean igual.
import { Chart, registerables, type Plugin } from 'chart.js';

Chart.register(...registerables);

// Series: azul y naranja validados (separación para daltonismo y contraste 3:1)
export const COLOR = {
  azul: '#2a78d6',
  naranja: '#eb6834',
  rejilla: '#e1e0d9',
  eje: '#c3c2b7',
  texto: '#374151',
  textoSuave: '#757575',
};

export interface SerieLinea {
  label: string;
  data: number[];
  color: string;
}

Chart.defaults.font.family = 'Inter, ui-sans-serif, system-ui, sans-serif';
Chart.defaults.font.size = 12;
Chart.defaults.color = COLOR.textoSuave;

export const numero = new Intl.NumberFormat('es-MX');
export const compacto = new Intl.NumberFormat('es-MX', { notation: 'compact', maximumFractionDigits: 1 });

export const tooltipBase = {
  backgroundColor: '#ffffff',
  borderColor: '#e2e8f0',
  borderWidth: 1,
  titleColor: COLOR.texto,
  bodyColor: COLOR.texto,
  titleFont: { weight: 600 as const },
  bodyFont: { weight: 500 as const },
  padding: 10,
  cornerRadius: 8,
  boxPadding: 6,
  usePointStyle: true,
};

// Línea vertical que sigue al puntero en gráficas de línea
export const lineaGuia: Plugin = {
  id: 'lineaGuia',
  afterDatasetsDraw(chart) {
    const activo = chart.tooltip?.getActiveElements()[0];
    if (!activo) return;
    const { ctx, chartArea } = chart;
    ctx.save();
    ctx.strokeStyle = COLOR.eje;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(activo.element.x, chartArea.top);
    ctx.lineTo(activo.element.x, chartArea.bottom);
    ctx.stroke();
    ctx.restore();
  },
};

// Valor al final de cada barra horizontal, en color de texto (no del dato)
export const valorEnBarra: Plugin = {
  id: 'valorEnBarra',
  afterDatasetsDraw(chart) {
    const { ctx, chartArea } = chart;
    ctx.save();
    ctx.fillStyle = COLOR.texto;
    ctx.font = `500 12px ${Chart.defaults.font.family}`;
    ctx.textBaseline = 'middle';
    chart.getDatasetMeta(0).data.forEach((barra, i) => {
      const valor = chart.data.datasets[0].data[i] as number;
      // Durante la animación la barra crece desde el eje: el valor nunca se dibuja antes de él
      ctx.fillText(numero.format(valor), Math.max(barra.x, chartArea.left) + 6, barra.y);
    });
    ctx.restore();
  },
};
