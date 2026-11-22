// Usuarios. Pueden usarlo los administradores de la plataforma (todas las empresas)
// y el admin de cada empresa (solo los usuarios de la suya, con rol admin o almacen).
// No se borran porque sus movimientos los referencian: se desactivan (estado = false).

import { Router, type Request } from 'express';
import { hashContrasena } from '../auth/contrasena.js';
import { ROLES, sesion, type Rol } from '../auth/sesion.js';
import { pool } from '../db.js';
import { HttpError, noEncontrado } from '../errores.js';
import { pagina, paginacion } from '../paginacion.js';
import { booleano, contrasena, correo, cuerpo, entero, enteroQuery, idRuta, opcion, opcionQuery, texto } from '../validar.js';

export const usuarios = Router();

const ROLES_EMPRESA = ['admin', 'almacen'] as const;

const COLUMNAS = `
  u.id_usuario, u.nombre, u.correo, u.rol, u.estado, u.fecha_registro,
  u.id_empresa, e.nombre AS empresa`;

// Empresa a la que se limita la consulta: la propia para un admin; para la plataforma,
// la que pida (o todas)
function alcance(req: Request, empresaPedida?: number): number | null {
  const s = sesion(req);
  if (s.rol === 'plataforma') return empresaPedida ?? null;
  return s.empresa!.id_empresa;
}

async function buscar(req: Request, id: number) {
  const empresa = alcance(req);
  const { rows } = await pool.query(
    `SELECT ${COLUMNAS} FROM usuarios u LEFT JOIN empresas e ON e.id_empresa = u.id_empresa
     WHERE u.id_usuario = $1 ${empresa === null ? '' : 'AND u.id_empresa = $2'}`,
    empresa === null ? [id] : [id, empresa],
  );
  if (!rows[0]) throw noEncontrado('Usuario');
  return rows[0] as { id_usuario: number; rol: Rol; id_empresa: number | null };
}

// GET /api/usuarios?q=&rol=&estado=activo|inactivo&id_empresa=&page=&limit=
usuarios.get('/', async (req, res) => {
  const q = String(req.query.q ?? '').trim();
  const rol = opcionQuery(req, 'rol', ROLES);
  const estado = opcionQuery(req, 'estado', ['activo', 'inactivo'] as const);
  const empresa = alcance(req, enteroQuery(req, 'id_empresa'));
  const { page, limit, offset } = paginacion(req);

  const condiciones: string[] = [];
  const valores: unknown[] = [];
  if (empresa !== null) {
    valores.push(empresa);
    condiciones.push(`u.id_empresa = $${valores.length}`);
  }
  if (q) {
    valores.push(`%${q}%`);
    condiciones.push(`(u.nombre ILIKE $${valores.length} OR u.correo ILIKE $${valores.length})`);
  }
  if (rol) {
    valores.push(rol);
    condiciones.push(`u.rol = $${valores.length}`);
  }
  if (estado) condiciones.push(estado === 'activo' ? 'u.estado' : 'NOT u.estado');
  const where = condiciones.length ? `WHERE ${condiciones.join(' AND ')}` : '';
  const desde = `FROM usuarios u LEFT JOIN empresas e ON e.id_empresa = u.id_empresa ${where}`;

  const [total, filas] = await Promise.all([
    pool.query<{ total: number }>(`SELECT count(*)::int AS total ${desde}`, valores),
    pool.query(
      `SELECT ${COLUMNAS} ${desde}
       ORDER BY u.nombre, u.id_usuario
       LIMIT $${valores.length + 1} OFFSET $${valores.length + 2}`,
      [...valores, limit, offset],
    ),
  ]);
  res.json(pagina(filas.rows, total.rows[0].total, page, limit));
});

// GET /api/usuarios/:id
usuarios.get('/:id', async (req, res) => {
  res.json(await buscar(req, idRuta(req, 'Usuario')));
});

// POST /api/usuarios - { nombre, correo, contrasena, rol, id_empresa? }
// id_empresa solo lo envía la plataforma; un admin siempre crea en su empresa
usuarios.post('/', async (req, res) => {
  const s = sesion(req);
  const b = cuerpo(req);
  const nombre = texto(b, 'nombre', { requerido: true, min: 2, max: 100 })!;
  const email = correo(b, 'correo', { requerido: true })!;
  const clave = contrasena(b, 'contrasena', { requerido: true })!;
  const rol = opcion(b, 'rol', s.rol === 'plataforma' ? ROLES : ROLES_EMPRESA, { requerido: true })!;

  let idEmpresa: number | null;
  if (s.rol !== 'plataforma') idEmpresa = s.empresa!.id_empresa;
  else if (rol === 'plataforma') idEmpresa = null;
  else {
    idEmpresa = entero(b, 'id_empresa', { requerido: true, min: 1 })!;
    const { rowCount } = await pool.query('SELECT 1 FROM empresas WHERE id_empresa = $1 AND estado', [idEmpresa]);
    if (!rowCount) throw new HttpError(400, 'La empresa no existe o está desactivada');
  }

  try {
    const { rows } = await pool.query<{ id_usuario: number }>(
      `INSERT INTO usuarios (id_empresa, nombre, correo, contrasena_hash, rol)
       VALUES ($1, $2, $3, $4, $5) RETURNING id_usuario`,
      [idEmpresa, nombre, email, await hashContrasena(clave), rol],
    );
    res.status(201).json(await buscar(req, rows[0].id_usuario));
  } catch (error) {
    if ((error as { code?: string }).code === '23505') throw new HttpError(409, 'Ya existe una cuenta con ese correo');
    throw error;
  }
});

// PATCH /api/usuarios/:id - { nombre?, correo?, rol?, estado?, contrasena? }
// El rol solo cambia entre admin y almacen (un usuario de plataforma no tiene empresa).
// Nadie puede desactivarse ni cambiarse el rol a sí mismo, para no quedarse sin acceso.
usuarios.patch('/:id', async (req, res) => {
  const s = sesion(req);
  const id = idRuta(req, 'Usuario');
  const actual = await buscar(req, id);
  const b = cuerpo(req);

  const cambios: [string, unknown][] = [];
  const nombre = texto(b, 'nombre', { min: 2, max: 100 });
  const email = correo(b, 'correo');
  const estado = booleano(b, 'estado');
  const clave = contrasena(b, 'contrasena');
  const rol = opcion(b, 'rol', ROLES);

  if (rol !== undefined && rol !== actual.rol) {
    if (id === s.id_usuario) throw new HttpError(400, 'No puedes cambiar tu propio rol');
    if (rol === 'plataforma' || actual.rol === 'plataforma') {
      throw new HttpError(400, 'El rol plataforma no se asigna ni se quita: crea un usuario nuevo');
    }
    cambios.push(['rol', rol]);
  }
  if (estado === false && id === s.id_usuario) throw new HttpError(400, 'No puedes desactivar tu propia cuenta');
  if (nombre !== undefined) cambios.push(['nombre', nombre]);
  if (email !== undefined) cambios.push(['correo', email]);
  if (estado !== undefined) cambios.push(['estado', estado]);
  if (clave !== undefined) cambios.push(['contrasena_hash', await hashContrasena(clave)]);
  if (!cambios.length) throw new HttpError(400, 'Envía al menos un campo: nombre, correo, rol, estado o contrasena');

  try {
    await pool.query(
      `UPDATE usuarios SET ${cambios.map(([c], i) => `${c} = $${i + 1}`).join(', ')} WHERE id_usuario = $${cambios.length + 1}`,
      [...cambios.map(([, v]) => v), id],
    );
  } catch (error) {
    if ((error as { code?: string }).code === '23505') throw new HttpError(409, 'Ya existe una cuenta con ese correo');
    throw error;
  }
  res.json(await buscar(req, id));
});
