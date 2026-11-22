// Hash de contraseñas con scrypt (incluido en Node, sin dependencias nativas).
// Formato: scrypt$N$r$p$sal$hash (sal y hash en base64url). El backend usa el
// mismo formato en backend/src/auth/contrasena.ts: si cambia uno, cambiar el otro.

import crypto from 'node:crypto';

const N = 16384;
const R = 8;
const P = 1;
const LONGITUD = 64;

export function hashContrasena(contrasena: string): string {
  const sal = crypto.randomBytes(16);
  const hash = crypto.scryptSync(contrasena, sal, LONGITUD, { N, r: R, p: P });
  return ['scrypt', N, R, P, sal.toString('base64url'), hash.toString('base64url')].join('$');
}
