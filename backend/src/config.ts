import path from 'node:path';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';

// El .env vive en la raíz del repositorio (ver .env.example)
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
dotenv.config({ path: path.join(root, '.env'), quiet: true });

function requerida(nombre: string): string {
  const valor = process.env[nombre];
  if (!valor) {
    throw new Error(`Falta ${nombre} en el .env. Copia .env.example a .env en la raíz del repositorio.`);
  }
  return valor;
}

export const config = {
  // La API se conecta con un usuario de solo lectura (lo crea npm run roles en etl/),
  // no con el dueño de la base que usa el ETL
  db: {
    host: process.env.POSTGRES_HOST ?? 'localhost',
    port: Number(process.env.POSTGRES_PORT ?? 5432),
    database: requerida('POSTGRES_DB'),
    user: requerida('API_DB_USER'),
    password: requerida('API_DB_PASSWORD'),
    // Neon (la base publicada) solo acepta conexiones cifradas
    ssl: process.env.POSTGRES_SSL === 'true',
  },
  port: Number(process.env.API_PORT ?? 3000),
  // Orígenes del frontend, separados por coma: Vite en desarrollo y la versión
  // compilada (vite preview), que es la que registra el Service Worker de la PWA
  corsOrigin: (process.env.CORS_ORIGIN ?? 'http://localhost:5173,http://localhost:4173').split(','),
};
