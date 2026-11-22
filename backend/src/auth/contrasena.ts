// Hash de contraseñas con scrypt (incluido en Node, sin dependencias nativas).
// Formato: scrypt$N$r$p$sal$hash (sal y hash en base64url). Es el mismo formato
// que usa el ETL (etl/src/contrasena.ts) para los administradores de la plataforma.

import crypto from 'node:crypto';
import { promisify } from 'node:util';

const scrypt = promisify(crypto.scrypt) as (
  contrasena: string,
  sal: Buffer,
  longitud: number,
  opciones: crypto.ScryptOptions,
) => Promise<Buffer>;

const N = 16384;
const R = 8;
const P = 1;
const LONGITUD = 64;

export async function hashContrasena(contrasena: string): Promise<string> {
  const sal = crypto.randomBytes(16);
  const hash = await scrypt(contrasena, sal, LONGITUD, { N, r: R, p: P });
  return ['scrypt', N, R, P, sal.toString('base64url'), hash.toString('base64url')].join('$');
}

// Un hash con otro formato (p. ej., 'sin-acceso' de los usuarios ficticios) nunca coincide
export async function verificarContrasena(contrasena: string, guardado: string): Promise<boolean> {
  const partes = guardado.split('$');
  if (partes.length !== 6 || partes[0] !== 'scrypt') return false;
  const [, n, r, p, sal, hash] = partes;
  const esperado = Buffer.from(hash, 'base64url');
  try {
    const calculado = await scrypt(contrasena, Buffer.from(sal, 'base64url'), esperado.length, {
      N: Number(n),
      r: Number(r),
      p: Number(p),
    });
    return crypto.timingSafeEqual(calculado, esperado);
  } catch {
    return false; // parámetros dañados en el hash guardado
  }
}

// Hash real de una contraseña aleatoria: al comparar contra él cuando el correo no
// existe, el login tarda lo mismo y no revela qué correos están registrados.
// Se calcula una sola vez, la primera vez que se necesita.
let senuelo: Promise<string> | null = null;
export function hashSenuelo(): Promise<string> {
  senuelo ??= hashContrasena(crypto.randomBytes(16).toString('hex'));
  return senuelo;
}
