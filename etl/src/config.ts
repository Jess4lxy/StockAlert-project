import path from 'node:path';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';

const here = path.dirname(fileURLToPath(import.meta.url));

export const ETL_DIR = path.resolve(here, '..');
export const ROOT_DIR = path.resolve(ETL_DIR, '..');

// El .env vive en la raíz del repositorio (ver .env.example)
dotenv.config({ path: path.join(ROOT_DIR, '.env'), quiet: true });

export const RAW_DIR = path.join(ETL_DIR, 'data', 'raw');
export const CLEAN_DIR = path.join(ETL_DIR, 'data', 'clean');
export const SAMPLE_DIR = path.join(ETL_DIR, 'data', 'sample');
export const OUTPUT_DIR = path.join(ETL_DIR, 'output');
export const SCHEMA_FILE = path.join(ROOT_DIR, 'db', 'schema.sql');
export const QUERIES_FILE = path.join(ETL_DIR, 'sql', 'consultas.sql');

// Semilla fija: cada ejecución genera exactamente los mismos datos
export const SEED = 2026;
export const TOTAL_MOVIMIENTOS = 10_000;

// Zona horaria del negocio (Mérida, UTC-6 sin horario de verano)
export const TZ_OFFSET = '-06:00';

export function databaseUrl(): string {
  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error('Falta DATABASE_URL. Copia .env.example a .env en la raíz del repositorio.');
  }
  return url;
}
