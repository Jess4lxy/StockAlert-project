import path from 'node:path';
import { ROOT_DIR } from './config.js';

// Resultados de la prueba de rendimiento (Tarea 3); sí se suben al repositorio
export const RESULTADOS_DIR = path.join(ROOT_DIR, 'docs', 'tarea3', 'resultados');

export interface Estadisticas {
  min: number;
  mediana: number;
  promedio: number;
  p95: number;
  max: number;
}
