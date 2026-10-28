// Paso 4 del ETL: ejecuta las consultas de sql/consultas.sql sobre los datos
// cargados y muestra el resultado y el tiempo de cada una.

import fs from 'node:fs';
import pg from 'pg';
import { QUERIES_FILE, databaseUrl } from './config.js';

function leerConsultas(): { titulo: string; sql: string }[] {
  const texto = fs.readFileSync(QUERIES_FILE, 'utf8');
  return texto
    .split(/^-- @consulta: /m)
    .slice(1)
    .map((bloque) => {
      const [titulo, ...resto] = bloque.split('\n');
      return { titulo: titulo.trim(), sql: resto.join('\n').trim() };
    });
}

async function main() {
  const client = new pg.Client({ connectionString: databaseUrl() });
  await client.connect();
  try {
    const consultas = leerConsultas();
    for (const [i, { titulo, sql }] of consultas.entries()) {
      const inicio = performance.now();
      const { rows, rowCount } = await client.query(sql);
      const ms = (performance.now() - inicio).toFixed(1);
      console.log(`\n${i + 1}. ${titulo} (${rowCount} filas, ${ms} ms)`);
      console.table(rows);
    }
  } finally {
    await client.end();
  }
}

main().catch((error) => {
  console.error('Error en las consultas:', error.message);
  process.exitCode = 1;
});
