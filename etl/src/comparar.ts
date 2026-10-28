// Compara benchmark_antes.json con benchmark_despues.json (medianas y promedios)
// y guarda el resumen en docs/tarea3/resultados/comparacion.json.

import fs from 'node:fs';
import path from 'node:path';
import { RESULTADOS_DIR, type Estadisticas } from './bench-comun.js';

interface Resultado {
  id: string;
  nombre: string;
  total: Estadisticas;
  db: Estadisticas;
}

function leer(etapa: string): { resultados: Resultado[]; corridas: number } {
  const archivo = path.join(RESULTADOS_DIR, `benchmark_${etapa}.json`);
  if (!fs.existsSync(archivo)) throw new Error(`Falta ${archivo}. Ejecuta npm run bench -- ${etapa}`);
  return JSON.parse(fs.readFileSync(archivo, 'utf8'));
}

const antes = leer('antes');
const despues = leer('despues');
const mejora = (a: number, d: number) => Math.round((1 - d / a) * 1000) / 10;

const filas = antes.resultados.map((a) => {
  const d = despues.resultados.find((r) => r.id === a.id)!;
  return {
    escenario: a.nombre,
    db_mediana_antes: a.db.mediana,
    db_mediana_despues: d.db.mediana,
    db_mejora_pct: mejora(a.db.mediana, d.db.mediana),
    db_promedio_antes: a.db.promedio,
    db_promedio_despues: d.db.promedio,
    total_mediana_antes: a.total.mediana,
    total_mediana_despues: d.total.mediana,
    total_mejora_pct: mejora(a.total.mediana, d.total.mediana),
  };
});

console.log(`Medianas en ms (${antes.corridas} corridas por escenario)`);
console.table(
  Object.fromEntries(
    filas.map((f) => [
      f.escenario,
      {
        'db antes': f.db_mediana_antes,
        'db después': f.db_mediana_despues,
        'mejora db %': f.db_mejora_pct,
        'total antes': f.total_mediana_antes,
        'total después': f.total_mediana_despues,
        'mejora total %': f.total_mejora_pct,
      },
    ]),
  ),
);
fs.writeFileSync(path.join(RESULTADOS_DIR, 'comparacion.json'), JSON.stringify(filas, null, 2) + '\n', 'utf8');
