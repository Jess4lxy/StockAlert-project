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

function secretoJwt(): string {
  const secreto = requerida('JWT_SECRET');
  if (secreto.length < 32) throw new Error('JWT_SECRET debe tener al menos 32 caracteres.');
  return secreto;
}

export const config = {
  // La API se conecta con su propio usuario (lo crea npm run roles en etl/): puede
  // leer, insertar y actualizar, pero no borrar ni cambiar tablas como el dueño de la base
  db: {
    host: process.env.POSTGRES_HOST ?? 'localhost',
    port: Number(process.env.POSTGRES_PORT ?? 5432),
    database: requerida('POSTGRES_DB'),
    user: requerida('API_DB_USER'),
    password: requerida('API_DB_PASSWORD'),
    // Neon (la base publicada) solo acepta conexiones cifradas
    ssl: process.env.POSTGRES_SSL === 'true',
  },
  // Firma de los tokens de sesión. Debe ser larga y aleatoria; si cambia, todas las
  // sesiones abiertas dejan de ser válidas.
  jwt: { secreto: secretoJwt(), expira: '12h' as const },
  // Aviso de alertas nuevas a un flujo de n8n (opcional)
  n8n: { url: process.env.N8N_WEBHOOK_URL || null, token: process.env.N8N_WEBHOOK_TOKEN || null },
  port: Number(process.env.API_PORT ?? 3000),
  // Orígenes del frontend, separados por coma: Vite en desarrollo y la versión
  // compilada (vite preview), que es la que registra el Service Worker de la PWA
  corsOrigin: (process.env.CORS_ORIGIN ?? 'http://localhost:5173,http://localhost:4173').split(','),
};
