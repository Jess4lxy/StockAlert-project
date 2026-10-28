import path from 'node:path';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';

// El .env vive en la raíz del repositorio (ver .env.example)
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
dotenv.config({ path: path.join(root, '.env'), quiet: true });

if (!process.env.DATABASE_URL) {
  throw new Error('Falta DATABASE_URL. Copia .env.example a .env en la raíz del repositorio.');
}

export const config = {
  databaseUrl: process.env.DATABASE_URL,
  port: Number(process.env.API_PORT ?? 3000),
  // Origen del frontend de Vite en desarrollo
  corsOrigin: process.env.CORS_ORIGIN ?? 'http://localhost:5173',
};
