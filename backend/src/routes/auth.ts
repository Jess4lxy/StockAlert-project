import { Router } from 'express';
import { hashContrasena, hashSenuelo, verificarContrasena } from '../auth/contrasena.js';
import { autenticar, cargarUsuario, firmarToken, sesion } from '../auth/sesion.js';
import { pool } from '../db.js';
import { HttpError } from '../errores.js';
import { claveEscrita, contrasena, correo, cuerpo, texto } from '../validar.js';

export const auth = Router();

async function respuestaSesion(idUsuario: number) {
  const usuario = await cargarUsuario(idUsuario);
  if (!usuario) throw new HttpError(403, 'La cuenta o su empresa están desactivadas');
  return { token: firmarToken(idUsuario), usuario };
}

// POST /api/auth/login - { correo, contrasena } → { token, usuario }
auth.post('/login', async (req, res) => {
  const b = cuerpo(req);
  const email = correo(b, 'correo', { requerido: true })!;
  const clave = claveEscrita(b, 'contrasena');

  const { rows } = await pool.query<{ id_usuario: number; contrasena_hash: string }>(
    'SELECT id_usuario, contrasena_hash FROM usuarios WHERE correo = $1',
    [email],
  );
  // Si el correo no existe se compara contra un hash señuelo: mismo tiempo de respuesta
  const valida = await verificarContrasena(clave, rows[0]?.contrasena_hash ?? (await hashSenuelo()));
  if (!rows[0] || !valida) throw new HttpError(401, 'Correo o contraseña incorrectos');
  res.json(await respuestaSesion(rows[0].id_usuario));
});

// POST /api/auth/registro - registro público de un negocio: crea la empresa y su
// administrador (el dueño) y devuelve la sesión iniciada
auth.post('/registro', async (req, res) => {
  const b = cuerpo(req);
  const empresa = texto(b, 'empresa', { requerido: true, min: 2, max: 150 })!;
  const nombre = texto(b, 'nombre', { requerido: true, min: 2, max: 100 })!;
  const email = correo(b, 'correo', { requerido: true })!;
  const clave = contrasena(b, 'contrasena', { requerido: true })!;
  const hash = await hashContrasena(clave);

  const client = await pool.connect();
  let idUsuario: number;
  try {
    await client.query('BEGIN');
    const e = await client.query<{ id_empresa: number }>(
      'INSERT INTO empresas (nombre) VALUES ($1) RETURNING id_empresa',
      [empresa],
    );
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
  res.status(201).json(await respuestaSesion(idUsuario));
});

// GET /api/auth/yo - datos del usuario de la sesión
auth.get('/yo', autenticar, (req, res) => {
  res.json(sesion(req));
});

// PATCH /api/auth/contrasena - { actual, nueva }
auth.patch('/contrasena', autenticar, async (req, res) => {
  const b = cuerpo(req);
  const actual = claveEscrita(b, 'actual');
  const nueva = contrasena(b, 'nueva', { requerido: true })!;
  const id = sesion(req).id_usuario;

  const { rows } = await pool.query<{ contrasena_hash: string }>('SELECT contrasena_hash FROM usuarios WHERE id_usuario = $1', [id]);
  if (!(await verificarContrasena(actual, rows[0].contrasena_hash))) throw new HttpError(400, 'La contraseña actual no es correcta');
  await pool.query('UPDATE usuarios SET contrasena_hash = $1 WHERE id_usuario = $2', [await hashContrasena(nueva), id]);
  res.status(204).end();
});
