// Refresh tokens (tabla sesiones). El token es un valor aleatorio de 256 bits; en la
// base solo se guarda su hash SHA-256, así que una copia de la base no permite entrar.
//
// Rotación: cada refresco marca el token usado y emite otro de la misma familia
// (la familia nace en el inicio de sesión). Si llega un token que ya se usó:
//   - hace menos de GRACIA_MS: casi seguro dos pestañas renovando a la vez, o una recarga
//     que cortó la respuesta y la cookie nunca recibió el token nuevo → se emite otro token
//     de la misma familia y nada se revoca;
//   - más tarde: alguien guardó una copia (posible robo) → se revoca la familia completa.

import crypto from 'node:crypto';
import { pool } from '../db.js';
import { HttpError } from '../errores.js';

export type Cliente = 'web' | 'movil';

export const DIAS_REFRESH = 30;
const GRACIA_MS = 30_000;

const hash = (token: string) => crypto.createHash('sha256').update(token).digest('hex');
const nuevoToken = () => crypto.randomBytes(32).toString('base64url');
const sesionInvalida = () => new HttpError(401, 'La sesión no es válida o ya expiró. Inicia sesión de nuevo.');

// Inicio de sesión: familia nueva
export async function crearSesion(idUsuario: number, cliente: Cliente): Promise<{ token: string; familia: string }> {
  const token = nuevoToken();
  const { rows } = await pool.query<{ familia: string }>(
    `INSERT INTO sesiones (id_usuario, familia, token_hash, cliente, fecha_expiracion)
     VALUES ($1, gen_random_uuid(), $2, $3, now() + make_interval(days => $4))
     RETURNING familia`,
    [idUsuario, hash(token), cliente, DIAS_REFRESH],
  );
  return { token, familia: rows[0].familia };
}

// Cambia un refresh token por otro. Devuelve el usuario dueño y el token nuevo.
export async function rotarSesion(token: string): Promise<{ idUsuario: number; idEmpresa: number | null; cliente: Cliente; familia: string; token: string }> {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    // FOR UPDATE: dos refrescos simultáneos con el mismo token se atienden uno tras otro
    const { rows } = await client.query<{
      id_sesion: number;
      id_usuario: number;
      id_empresa: number | null;
      familia: string;
      cliente: Cliente;
      vencida: boolean;
      revocada: boolean;
      usada_hace_ms: number | null;
    }>(
      `SELECT id_sesion, id_usuario, id_empresa, familia, cliente,
              fecha_expiracion <= now() AS vencida,
              fecha_revocacion IS NOT NULL AS revocada,
              (extract(epoch FROM now() - fecha_uso) * 1000)::float8 AS usada_hace_ms
       FROM sesiones WHERE token_hash = $1 FOR UPDATE`,
      [hash(token)],
    );
    const s = rows[0];
    if (!s || s.vencida || s.revocada) throw sesionInvalida();
    // Dentro de la gracia se emite otro token de la familia: la gracia cuenta desde el primer
    // uso, así que reenviar el mismo token después ya no sirve
    if (s.usada_hace_ms !== null && s.usada_hace_ms >= GRACIA_MS) {
      await client.query('UPDATE sesiones SET fecha_revocacion = now() WHERE familia = $1 AND fecha_revocacion IS NULL', [s.familia]);
      await client.query('COMMIT');
      throw new HttpError(401, 'Por seguridad se cerró la sesión: se usó un token de renovación que ya había sido reemplazado. Inicia sesión de nuevo.');
    }

    const siguiente = nuevoToken();
    if (s.usada_hace_ms === null) await client.query('UPDATE sesiones SET fecha_uso = now() WHERE id_sesion = $1', [s.id_sesion]);
    await client.query(
      `INSERT INTO sesiones (id_usuario, id_empresa, familia, token_hash, cliente, fecha_expiracion)
       VALUES ($1, $2, $3, $4, $5, now() + make_interval(days => $6))`,
      [s.id_usuario, s.id_empresa, s.familia, hash(siguiente), s.cliente, DIAS_REFRESH],
    );
    await client.query('COMMIT');
    return { idUsuario: s.id_usuario, idEmpresa: s.id_empresa, cliente: s.cliente, familia: s.familia, token: siguiente };
  } catch (error) {
    await client.query('ROLLBACK').catch(() => {});
    throw error;
  } finally {
    client.release();
  }
}

// Cambio de empresa: la sesión de este dispositivo la conserva al renovar el token
export async function guardarEmpresaDeSesion(familia: string, idEmpresa: number | null): Promise<void> {
  await pool.query('UPDATE sesiones SET id_empresa = $2 WHERE familia = $1 AND fecha_revocacion IS NULL', [familia, idEmpresa]);
}

// Cerrar sesión: revoca la familia del token (ese dispositivo)
export async function revocarPorToken(token: string): Promise<void> {
  await pool.query(
    `UPDATE sesiones SET fecha_revocacion = now()
     WHERE familia = (SELECT familia FROM sesiones WHERE token_hash = $1) AND fecha_revocacion IS NULL`,
    [hash(token)],
  );
}

export async function revocarFamilia(familia: string): Promise<void> {
  await pool.query('UPDATE sesiones SET fecha_revocacion = now() WHERE familia = $1 AND fecha_revocacion IS NULL', [familia]);
}

// Cambio de contraseña o usuario desactivado: cierra sus sesiones en todos los
// dispositivos, salvo (si se indica) la del dispositivo que hizo el cambio
export async function revocarSesionesDeUsuario(idUsuario: number, exceptoFamilia?: string): Promise<void> {
  await pool.query(
    `UPDATE sesiones SET fecha_revocacion = now()
     WHERE id_usuario = $1 AND fecha_revocacion IS NULL AND ($2::uuid IS NULL OR familia <> $2::uuid)`,
    [idUsuario, exceptoFamilia ?? null],
  );
}
