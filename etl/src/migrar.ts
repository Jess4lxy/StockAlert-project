// Aplica las migraciones de db/migraciones/ en orden (001, 002...). Cada una usa
// IF NOT EXISTS, así que se puede correr varias veces y nunca borra datos: es la
// forma de actualizar una base que ya está en uso (p. ej., la publicada en Neon).
// npm run load también las aplica al recrear el esquema.

import fs from 'node:fs';
import path from 'node:path';
import pg from 'pg';
import { MIGRACIONES_DIR, conexion } from './config.js';

export function archivosDeMigracion(): string[] {
  return fs
    .readdirSync(MIGRACIONES_DIR)
    .filter((f) => /^\d{3}_.+\.sql$/.test(f))
    .sort();
}

export async function aplicarMigraciones(client: pg.ClientBase) {
  for (const archivo of archivosDeMigracion()) {
    await client.query(fs.readFileSync(path.join(MIGRACIONES_DIR, archivo), 'utf8'));
  }
}

async function main() {
  const client = new pg.Client(conexion());
  await client.connect();
  try {
    await client.query('BEGIN');
    await aplicarMigraciones(client);
    await client.query('COMMIT');
    console.log(`Migraciones aplicadas: ${archivosDeMigracion().join(', ')}`);
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    await client.end();
  }
}

// Solo al ejecutarlo directamente (npm run migrar), no al importarlo desde load.ts
if (process.argv[1] && path.resolve(process.argv[1]).replace(/\.ts$/, '') === path.resolve(import.meta.filename).replace(/\.ts$/, '')) {
  main().catch((error) => {
    console.error('Error al aplicar las migraciones:', error.message);
    process.exitCode = 1;
  });
}
