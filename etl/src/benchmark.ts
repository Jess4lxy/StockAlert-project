// Prueba de rendimiento de la consulta de referencia (Tarea 3): el listado de
// movimientos que usa la pantalla web. Llama a la API varias veces en las mismas
// condiciones y registra dos tiempos por petición:
//   - total: lo que tarda la petición HTTP completa (lo que percibe el usuario)
//   - db: lo que tardan las consultas en PostgreSQL (encabezado Server-Timing)
//
// Uso: npm run bench -- antes   |   npm run bench -- despues
// Requiere la API corriendo (backend: npm run dev).

import fs from 'node:fs';
import path from 'node:path';
import pg from 'pg';
import { RESULTADOS_DIR, type Estadisticas } from './bench-comun.js';
import { databaseUrl } from './config.js';

const API_URL = process.env.BENCH_API_URL ?? `http://localhost:${process.env.API_PORT ?? 3000}/api`;
const CALENTAMIENTO = 5; // corridas que no se cuentan (caché de PostgreSQL y de Node)
const CORRIDAS = 30;

const ESCENARIOS = [
  { id: 'inicio', nombre: 'Primera página sin filtros', query: 'page=1&limit=20' },
  { id: 'busqueda', nombre: 'Búsqueda "cuaderno" + filtro salida', query: 'q=cuaderno&tipo=salida&page=1&limit=20' },
  { id: 'categoria', nombre: 'Filtro por categoría, página 10', query: 'categoria=Papeler%C3%ADa&page=10&limit=20' },
];

function estadisticas(valores: number[]): Estadisticas {
  const v = [...valores].sort((a, b) => a - b);
  const percentil = (p: number) => v[Math.min(v.length - 1, Math.ceil((p / 100) * v.length) - 1)];
  const medio = Math.floor(v.length / 2);
  const redondear = (n: number) => Math.round(n * 100) / 100;
  return {
    min: redondear(v[0]),
    mediana: redondear(v.length % 2 ? v[medio] : (v[medio - 1] + v[medio]) / 2),
    promedio: redondear(v.reduce((a, b) => a + b, 0) / v.length),
    p95: redondear(percentil(95)),
    max: redondear(v[v.length - 1]),
  };
}

async function medir(query: string) {
  const inicio = performance.now();
  const res = await fetch(`${API_URL}/movimientos?${query}`);
  await res.arrayBuffer();
  const total = performance.now() - inicio;
  if (!res.ok) throw new Error(`La API respondió ${res.status}`);
  const db = Number(res.headers.get('server-timing')?.match(/dur=([\d.]+)/)?.[1]);
  return { total, db };
}

async function indicesActuales(): Promise<string[]> {
  const client = new pg.Client({ connectionString: databaseUrl() });
  await client.connect();
  try {
    const { rows } = await client.query<{ indexname: string }>(
      `SELECT indexname FROM pg_indexes WHERE tablename = 'movimientos' ORDER BY indexname`,
    );
    return rows.map((r) => r.indexname);
  } finally {
    await client.end();
  }
}

async function main() {
  const etapa = process.argv[2];
  if (etapa !== 'antes' && etapa !== 'despues') {
    throw new Error('Indica la etapa: npm run bench -- antes  (o despues)');
  }

  const indices = await indicesActuales();
  console.log(`Etapa: ${etapa}. Índices en movimientos: ${indices.join(', ')}`);
  console.log(`${CALENTAMIENTO} corridas de calentamiento + ${CORRIDAS} medidas por escenario\n`);

  const resultados = [];
  for (const escenario of ESCENARIOS) {
    for (let i = 0; i < CALENTAMIENTO; i++) await medir(escenario.query);
    const total: number[] = [];
    const db: number[] = [];
    for (let i = 0; i < CORRIDAS; i++) {
      const m = await medir(escenario.query);
      total.push(m.total);
      db.push(m.db);
    }
    resultados.push({
      ...escenario,
      total: estadisticas(total),
      db: estadisticas(db),
      corridas: { total: total.map((n) => +n.toFixed(2)), db },
    });
  }

  console.table(
    Object.fromEntries(
      resultados.map((r) => [
        r.nombre,
        { 'db mediana (ms)': r.db.mediana, 'db promedio': r.db.promedio, 'total mediana (ms)': r.total.mediana, 'total p95': r.total.p95 },
      ]),
    ),
  );

  fs.mkdirSync(RESULTADOS_DIR, { recursive: true });
  const archivo = path.join(RESULTADOS_DIR, `benchmark_${etapa}.json`);
  const salida = { etapa, fecha: new Date().toISOString(), api: API_URL, calentamiento: CALENTAMIENTO, corridas: CORRIDAS, indices, resultados };
  fs.writeFileSync(archivo, JSON.stringify(salida, null, 2) + '\n', 'utf8');
  console.log(`\nResultados en ${path.relative(process.cwd(), archivo)}`);
}

main().catch((error) => {
  console.error('Error en la prueba:', error.message);
  process.exitCode = 1;
});
