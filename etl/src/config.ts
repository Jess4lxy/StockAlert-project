import path from 'node:path';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';
import type pg from 'pg';

const here = path.dirname(fileURLToPath(import.meta.url));

export const ETL_DIR = path.resolve(here, '..');
export const ROOT_DIR = path.resolve(ETL_DIR, '..');

// El .env vive en la raíz del repositorio (ver .env.example). ENV_FILE permite usar
// otro archivo, por ejemplo .env.neon para cargar los datos en la base publicada.
dotenv.config({ path: path.resolve(ROOT_DIR, process.env.ENV_FILE ?? '.env'), quiet: true });

export const RAW_DIR = path.join(ETL_DIR, 'data', 'raw');
export const CLEAN_DIR = path.join(ETL_DIR, 'data', 'clean');
export const SAMPLE_DIR = path.join(ETL_DIR, 'data', 'sample');
export const OUTPUT_DIR = path.join(ETL_DIR, 'output');
export const SCHEMA_FILE = path.join(ROOT_DIR, 'db', 'schema.sql');
export const MIGRACIONES_DIR = path.join(ROOT_DIR, 'db', 'migraciones');
export const QUERIES_FILE = path.join(ETL_DIR, 'sql', 'consultas.sql');

// Semilla fija: cada ejecución genera exactamente los mismos datos
export const SEED = 2026;
export const TOTAL_MOVIMIENTOS = 10_000;

// Zona horaria del negocio (Mérida, UTC-6 sin horario de verano)
export const TZ_OFFSET = '-06:00';

// Conexión del ETL: usa el usuario dueño de la base (POSTGRES_USER), porque recrea
// las tablas, carga los datos y crea índices y usuarios. Cada contraseña está una
// sola vez en el .env y no hace falta escaparla en una URL.
export function requerida(nombre: string): string {
  const valor = process.env[nombre];
  if (!valor) {
    throw new Error(`Falta ${nombre} en el .env. Copia .env.example a .env en la raíz del repositorio.`);
  }
  return valor;
}

export function conexion(): pg.ClientConfig {
  return {
    host: process.env.POSTGRES_HOST ?? 'localhost',
    port: Number(process.env.POSTGRES_PORT ?? 5432),
    database: requerida('POSTGRES_DB'),
    user: requerida('POSTGRES_USER'),
    password: requerida('POSTGRES_PASSWORD'),
    // Neon (la base publicada) solo acepta conexiones cifradas
    ssl: process.env.POSTGRES_SSL === 'true',
  };
}
