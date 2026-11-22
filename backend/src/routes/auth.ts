// Sesión. El token de acceso (JWT) dura 15 minutos; el refresh token (30 días) lo
// renueva con POST /refresh y se rota en cada uso.
//   - Web (cliente: "web", por defecto): el refresh token viaja en una cookie httpOnly
//     limitada a /api/auth, que JavaScript no puede leer.
//   - Móvil (cliente: "movil"): el refresh token viaja en el JSON y la app lo guarda en
//     su almacenamiento seguro.

import { Router, type Request, type Response } from 'express';
import { hashContrasena, hashSenuelo, verificarContrasena } from '../auth/contrasena.js';
import { DIAS_REFRESH, crearSesion, revocarPorToken, revocarSesionesDeUsuario, rotarSesion, type Cliente } from '../auth/refresh.js';
import { autenticar, cargarUsuario, firmarToken, sesion } from '../auth/sesion.js';
import { config } from '../config.js';
import { pool } from '../db.js';
import { HttpError } from '../errores.js';
import { claveEscrita, contrasena, correo, cuerpo, opcion, texto } from '../validar.js';

export const auth = Router();

const COOKIE = 'stockalert_refresh';
const CLIENTES = ['web', 'movil'] as const;

const opcionesCookie = {
  httpOnly: true,
  // En Vercel siempre es HTTPS; en la computadora la API corre en http://localhost
  secure: !!process.env.VERCEL,
  sameSite: 'strict' as const,
  path: '/api/auth',
};

function leerCookie(req: Request): string | null {
  for (const parte of (req.headers.cookie ?? '').split(';')) {
    const [nombre, ...valor] = parte.trim().split('=');
    if (nombre === COOKIE) return decodeURIComponent(valor.join('='));
  }
  return null;
}

// Refresh token del cliente: cookie (web) o campo refresh_token del cuerpo (móvil)
function refreshDe(req: Request): string | null {
  const b = req.body && typeof req.body === 'object' ? (req.body as Record<string, unknown>) : {};
  if (typeof b.refresh_token === 'string' && b.refresh_token) return b.refresh_token;
  return leerCookie(req);
}

// Respuesta común de login, registro y refresh
async function responderSesion(res: Response, idUsuario: number, sesionNueva: { token: string; familia: string; cliente: Cliente }, status = 200) {
  const usuario = await cargarUsuario(idUsuario);
  if (!usuario) throw new HttpError(403, 'La cuenta o su empresa están desactivadas');
  const respuesta: Record<string, unknown> = {
    token: firmarToken(idUsuario, sesionNueva.familia),
    expira_en: config.jwt.expiraSegundos,
    usuario,
  };
  if (sesionNueva.cliente === 'movil') {
    respuesta.refresh_token = sesionNueva.token;
    respuesta.refresh_expira_en = DIAS_REFRESH * 24 * 60 * 60;
  } else {
    res.cookie(COOKIE, sesionNueva.token, { ...opcionesCookie, maxAge: DIAS_REFRESH * 24 * 60 * 60 * 1000 });
  }
  res.status(status).json(respuesta);
}

// POST /api/auth/login - { correo, contrasena, cliente? } → { token, expira_en, usuario, refresh_token? }
auth.post('/login', async (req, res) => {
  const b = cuerpo(req);
  const email = correo(b, 'correo', { requerido: true })!;
  const clave = claveEscrita(b, 'contrasena');
  const cliente = opcion(b, 'cliente', CLIENTES) ?? 'web';

  const { rows } = await pool.query<{ id_usuario: number; contrasena_hash: string }>(
    'SELECT id_usuario, contrasena_hash FROM usuarios WHERE correo = $1',
    [email],
  );
  // Si el correo no existe se compara contra un hash señuelo: mismo tiempo de respuesta
  const valida = await verificarContrasena(clave, rows[0]?.contrasena_hash ?? (await hashSenuelo()));
  if (!rows[0] || !valida) throw new HttpError(401, 'Correo o contraseña incorrectos');
  if (!(await cargarUsuario(rows[0].id_usuario))) throw new HttpError(403, 'La cuenta o su empresa están desactivadas');

  const nueva = await crearSesion(rows[0].id_usuario, cliente);
  await responderSesion(res, rows[0].id_usuario, { ...nueva, cliente });
});

// POST /api/auth/registro - registro público de un negocio: crea la empresa y su
// administrador (el dueño) y devuelve la sesión iniciada
auth.post('/registro', async (req, res) => {
  const b = cuerpo(req);
  const empresa = texto(b, 'empresa', { requerido: true, min: 2, max: 150 })!;
  const nombre = texto(b, 'nombre', { requerido: true, min: 2, max: 100 })!;
  const email = correo(b, 'correo', { requerido: true })!;
  const clave = contrasena(b, 'contrasena', { requerido: true })!;
  const cliente = opcion(b, 'cliente', CLIENTES) ?? 'web';
  const hash = await hashContrasena(clave);

  const client = await pool.connect();
  let idUsuario: number;
  try {
    await client.query('BEGIN');
    const e = await client.query<{ id_empresa: number }>('INSERT INTO empresas (nombre) VALUES ($1) RETURNING id_empresa', [empresa]);
    const u = await client.query<{ id_usuario: number }>(
      `INSERT INTO usuarios (id_empresa, nombre, correo, contrasena_hash, rol)
       VALUES ($1, $2, $3, $4, 'admin') RETURNING id_usuario`,
      [e.rows[0].id_empresa, nombre, email, hash],
    );
    await client.query('COMMIT');
    idUsuario = u.rows[0].id_usuario;
  } catch (error) {
    await client.query('ROLLBACK');
    if ((error as { code?: string }).code === '23505') throw new HttpError(409, 'Ya existe una cuenta con ese correo');
    throw error;
  } finally {
    client.release();
  }
  const nueva = await crearSesion(idUsuario, cliente);
  await responderSesion(res, idUsuario, { ...nueva, cliente }, 201);
});

// POST /api/auth/refresh - cambia el refresh token (cookie o { refresh_token }) por un
// token de acceso nuevo y un refresh token nuevo (rotación)
auth.post('/refresh', async (req, res) => {
  const token = refreshDe(req);
  if (!token) throw new HttpError(401, 'Falta el refresh token. Inicia sesión de nuevo.');
  let r: Awaited<ReturnType<typeof rotarSesion>>;
  try {
    r = await rotarSesion(token);
  } catch (error) {
    // Token inválido, vencido, revocado o reutilizado: la cookie ya no sirve, se borra
    if (error instanceof HttpError && error.status === 401) res.clearCookie(COOKIE, opcionesCookie);
    throw error;
  }
  if (!(await cargarUsuario(r.idUsuario))) {
    await revocarPorToken(r.token);
    res.clearCookie(COOKIE, opcionesCookie);
    throw new HttpError(401, 'La cuenta o su empresa están desactivadas');
  }
  await responderSesion(res, r.idUsuario, r);
});

// POST /api/auth/logout - cierra la sesión de este dispositivo (cookie o { refresh_token }).
// Responde 204 aunque el token ya no fuera válido: el resultado es el mismo.
auth.post('/logout', async (req, res) => {
  const token = refreshDe(req);
  if (token) await revocarPorToken(token);
  res.clearCookie(COOKIE, opcionesCookie);
  res.status(204).end();
});

// GET /api/auth/yo - datos del usuario de la sesión
auth.get('/yo', autenticar, (req, res) => {
  res.json(sesion(req));
});

// PATCH /api/auth/contrasena - { actual, nueva }. Cierra las sesiones de los demás
// dispositivos; la de este sigue abierta.
auth.patch('/contrasena', autenticar, async (req, res) => {
  const b = cuerpo(req);
  const actual = claveEscrita(b, 'actual');
  const nueva = contrasena(b, 'nueva', { requerido: true })!;
  const id = sesion(req).id_usuario;

  const { rows } = await pool.query<{ contrasena_hash: string }>('SELECT contrasena_hash FROM usuarios WHERE id_usuario = $1', [id]);
  if (!(await verificarContrasena(actual, rows[0].contrasena_hash))) throw new HttpError(400, 'La contraseña actual no es correcta');
  await pool.query('UPDATE usuarios SET contrasena_hash = $1 WHERE id_usuario = $2', [await hashContrasena(nueva), id]);
  await revocarSesionesDeUsuario(id, req.familia ?? undefined);
  res.status(204).end();
});
