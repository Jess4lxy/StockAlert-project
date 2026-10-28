// Aplica la optimización de la Tarea 3 (db/indices.sql) sobre la base ya cargada.
// Para volver al estado sin índices basta con ejecutar de nuevo npm run load.

import fs from 'node:fs';
import path from 'node:path';
import pg from 'pg';
import { ROOT_DIR, databaseUrl } from './config.js';

async function main() {
  const client = new pg.Client({ connectionString: databaseUrl() });
  await client.connect();
  try {
    await client.query(fs.readFileSync(path.join(ROOT_DIR, 'db', 'indices.sql'), 'utf8'));
    const { rows } = await client.query<{ indexname: string; indexdef: string }>(
      `SELECT indexname, indexdef FROM pg_indexes WHERE tablename = 'movimientos' ORDER BY indexname`,
    );
    console.log('Índices en movimientos:');
    console.table(rows);
  } finally {
    await client.end();
  }
}

main().catch((error) => {
  console.error('Error al crear los índices:', error.message);
  process.exitCode = 1;
});
