// Empresas: solo los administradores de la plataforma (permitir('plataforma') en index.ts).
// No se borran: se desactivan (estado = false) y sus usuarios dejan de poder entrar.

import { Router } from 'express';
import { agregarAEmpresa } from '../auth/membresias.js';
import { pool } from '../db.js';
import { HttpError, noEncontrado } from '../errores.js';
import { pagina, paginacion } from '../paginacion.js';
import { booleano, contrasena, correo, cuerpo, idRuta, opcionQuery, texto } from '../validar.js';

export const empresas = Router();

const COLUMNAS = `
  e.id_empresa, e.nombre, e.fecha_registro, e.estado,
  (SELECT count(*)::int FROM usuarios_empresas ue JOIN usuarios u ON u.id_usuario = ue.id_usuario
   WHERE ue.id_empresa = e.id_empresa AND ue.estado AND u.estado) AS usuarios,
  (SELECT count(*)::int FROM productos p WHERE p.id_empresa = e.id_empresa AND p.estado) AS productos`;

async function buscar(id: number) {
  const { rows } = await pool.query(`SELECT ${COLUMNAS} FROM empresas e WHERE e.id_empresa = $1`, [id]);
  if (!rows[0]) throw noEncontrado('Empresa');
  return rows[0];
}

// GET /api/empresas?q=&estado=activa|inactiva&page=&limit=
empresas.get('/', async (req, res) => {
  const q = String(req.query.q ?? '').trim();
  const estado = opcionQuery(req, 'estado', ['activa', 'inactiva'] as const);
  const { page, limit, offset } = paginacion(req);

  const condiciones: string[] = [];
  const valores: unknown[] = [];
  if (q) {
    valores.push(`%${q}%`);
    condiciones.push(`e.nombre ILIKE $${valores.length}`);
  }
  if (estado) condiciones.push(estado === 'activa' ? 'e.estado' : 'NOT e.estado');
  const where = condiciones.length ? `WHERE ${condiciones.join(' AND ')}` : '';

  const [total, filas] = await Promise.all([
    pool.query<{ total: number }>(`SELECT count(*)::int AS total FROM empresas e ${where}`, valores),
    pool.query(
      `SELECT ${COLUMNAS} FROM empresas e ${where}
       ORDER BY e.nombre, e.id_empresa
       LIMIT $${valores.length + 1} OFFSET $${valores.length + 2}`,
      [...valores, limit, offset],
    ),
  ]);
  res.json(pagina(filas.rows, total.rows[0].total, page, limit));
});

// GET /api/empresas/:id
empresas.get('/:id', async (req, res) => {
  res.json(await buscar(idRuta(req, 'Empresa')));
});

// POST /api/empresas - { nombre, admin?: { nombre, correo, contrasena } }
// Con admin, agrega también al dueño de la empresa en la misma operación: si el correo ya
// tiene cuenta se usa esa (conserva su contraseña); si no, se crea
empresas.post('/', async (req, res) => {
  const b = cuerpo(req);
  const nombre = texto(b, 'nombre', { requerido: true, min: 2, max: 150 })!;
  let admin: { nombre: string; correo: string; contrasena?: string } | null = null;
  if (b.admin !== undefined && b.admin !== null) {
    if (typeof b.admin !== 'object' || Array.isArray(b.admin)) throw new HttpError(400, 'admin debe ser un objeto');
    const a = b.admin as Record<string, unknown>;
    admin = {
      nombre: texto(a, 'nombre', { requerido: true, min: 2, max: 100 })!,
      correo: correo(a, 'correo', { requerido: true })!,
      contrasena: contrasena(a, 'contrasena'),
    };
  }

  const client = await pool.connect();
  let id: number;
  try {
    await client.query('BEGIN');
    const { rows } = await client.query<{ id_empresa: number }>('INSERT INTO empresas (nombre) VALUES ($1) RETURNING id_empresa', [nombre]);
    id = rows[0].id_empresa;
    if (admin) {
      await agregarAEmpresa(client, { ...admin, rol: 'admin', idEmpresa: id });
    }
    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    if ((error as { code?: string }).code === '23505') throw new HttpError(409, 'Ya existe una cuenta con ese correo');
    throw error;
  } finally {
    client.release();
  }
  res.status(201).json(await buscar(id));
});

// PATCH /api/empresas/:id - { nombre?, estado? }
empresas.patch('/:id', async (req, res) => {
  const id = idRuta(req, 'Empresa');
  const b = cuerpo(req);
  const cambios: [string, unknown][] = [];
  const nombre = texto(b, 'nombre', { min: 2, max: 150 });
  const estado = booleano(b, 'estado');
  if (nombre !== undefined) cambios.push(['nombre', nombre]);
  if (estado !== undefined) cambios.push(['estado', estado]);
  if (!cambios.length) throw new HttpError(400, 'Envía al menos un campo: nombre o estado');

  const { rowCount } = await pool.query(
    `UPDATE empresas SET ${cambios.map(([c], i) => `${c} = $${i + 1}`).join(', ')} WHERE id_empresa = $${cambios.length + 1}`,
    [...cambios.map(([, v]) => v), id],
  );
  if (!rowCount) throw noEncontrado('Empresa');
  res.json(await buscar(id));
});
