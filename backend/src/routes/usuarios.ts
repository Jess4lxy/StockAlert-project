// Usuarios. Pueden usarlo los administradores de la plataforma (todas las empresas)
// y el admin de cada empresa (solo los usuarios de la suya, con rol admin o almacen).
// Una persona tiene una sola cuenta y puede estar en varias empresas: cada fila es una
// persona en una empresa (id_usuario + id_empresa), con el rol y estado que tiene ahí.
// No se borran porque sus movimientos los referencian: se desactivan (estado = false).

import { Router, type Request } from 'express';
import { hashContrasena } from '../auth/contrasena.js';
import { agregarAEmpresa } from '../auth/membresias.js';
import { revocarSesionesDeUsuario } from '../auth/refresh.js';
import { ROLES, sesion, type Rol } from '../auth/sesion.js';
import { pool } from '../db.js';
import { HttpError, noEncontrado } from '../errores.js';
import { pagina, paginacion } from '../paginacion.js';
import { booleano, contrasena, correo, cuerpo, entero, enteroQuery, idRuta, opcion, opcionQuery, texto } from '../validar.js';

export const usuarios = Router();

const ROLES_EMPRESA = ['admin', 'almacen'] as const;

// cuenta_compartida: también está en otras empresas o administra la plataforma, así que el
// admin de una empresa no puede cambiarle nombre, correo ni contraseña
const COLUMNAS = `
  u.id_usuario, u.nombre, u.correo, v.rol, (u.estado AND v.estado) AS estado, v.fecha_registro,
  v.id_empresa, e.nombre AS empresa,
  (u.rol = 'plataforma' OR (SELECT count(*) FROM usuarios_empresas o WHERE o.id_usuario = u.id_usuario) > 1) AS cuenta_compartida`;

// Las empresas de cada persona y, si administra la plataforma, esa fila (sin empresa)
const DESDE = `
  FROM usuarios u
  JOIN LATERAL (
    SELECT ue.id_empresa, ue.rol, ue.estado, ue.fecha_registro FROM usuarios_empresas ue WHERE ue.id_usuario = u.id_usuario
    UNION ALL
    SELECT NULL, u.rol, true, u.fecha_registro WHERE u.rol = 'plataforma'
  ) v ON true
  LEFT JOIN empresas e ON e.id_empresa = v.id_empresa`;

interface Fila {
  id_usuario: number;
  rol: Rol;
  id_empresa: number | null;
  cuenta_compartida: boolean;
}

// Empresa a la que se limita la consulta: la propia para un admin; para la plataforma,
// la que pida (o todas)
function alcance(req: Request, empresaPedida?: number): number | null {
  const s = sesion(req);
  if (s.rol === 'plataforma') return empresaPedida ?? null;
  return s.empresa!.id_empresa;
}

// Sin empresa (solo la plataforma): su fila de plataforma o la de su primera empresa
async function buscar(req: Request, id: number, empresaPedida?: number): Promise<Fila> {
  const empresa = alcance(req, empresaPedida);
  const { rows } = await pool.query<Fila>(
    `SELECT ${COLUMNAS} ${DESDE}
     WHERE u.id_usuario = $1 AND ($2::int IS NULL OR v.id_empresa = $2)
     ORDER BY (v.id_empresa IS NOT DISTINCT FROM u.id_empresa) DESC, v.id_empresa
     LIMIT 1`,
    [id, empresa],
  );
  if (!rows[0]) throw noEncontrado('Usuario');
  return rows[0];
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
    condiciones.push(`v.id_empresa = $${valores.length}`);
  }
  if (q) {
    valores.push(`%${q}%`);
    condiciones.push(`(u.nombre ILIKE $${valores.length} OR u.correo ILIKE $${valores.length})`);
  }
  if (rol) {
    valores.push(rol);
    condiciones.push(`v.rol = $${valores.length}`);
  }
  if (estado) condiciones.push(`${estado === 'activo' ? '' : 'NOT '}(u.estado AND v.estado)`);
  const desde = `${DESDE} ${condiciones.length ? `WHERE ${condiciones.join(' AND ')}` : ''}`;

  const [total, filas] = await Promise.all([
    pool.query<{ total: number }>(`SELECT count(*)::int AS total ${desde}`, valores),
    pool.query(
      `SELECT ${COLUMNAS} ${desde}
       ORDER BY u.nombre, u.id_usuario, e.nombre NULLS FIRST, v.id_empresa
       LIMIT $${valores.length + 1} OFFSET $${valores.length + 2}`,
      [...valores, limit, offset],
    ),
  ]);
  res.json(pagina(filas.rows, total.rows[0].total, page, limit));
});

// GET /api/usuarios/:id?id_empresa=
usuarios.get('/:id', async (req, res) => {
  res.json(await buscar(req, idRuta(req, 'Usuario'), enteroQuery(req, 'id_empresa')));
});

// POST /api/usuarios - { nombre, correo, contrasena?, rol, id_empresa? }
// id_empresa solo lo envía la plataforma; un admin siempre agrega a su empresa.
// Si el correo ya tiene cuenta, se agrega esa persona a la empresa (cuenta_existente: true)
// y se ignoran nombre y contrasena: conserva los suyos.
usuarios.post('/', async (req, res) => {
  const s = sesion(req);
  const b = cuerpo(req);
  const nombre = texto(b, 'nombre', { requerido: true, min: 2, max: 100 })!;
  const email = correo(b, 'correo', { requerido: true })!;
  const rol = opcion(b, 'rol', s.rol === 'plataforma' ? ROLES : ROLES_EMPRESA, { requerido: true })!;
  const clave = contrasena(b, 'contrasena', { requerido: rol === 'plataforma' });

  let idEmpresa: number | null;
  if (s.rol !== 'plataforma') idEmpresa = s.empresa!.id_empresa;
  else if (rol === 'plataforma') idEmpresa = null;
  else {
    idEmpresa = entero(b, 'id_empresa', { requerido: true, min: 1 })!;
    const { rowCount } = await pool.query('SELECT 1 FROM empresas WHERE id_empresa = $1 AND estado', [idEmpresa]);
    if (!rowCount) throw new HttpError(400, 'La empresa no existe o está desactivada');
  }

  const client = await pool.connect();
  let alta: { idUsuario: number; existente: boolean };
  try {
    await client.query('BEGIN');
    if (rol === 'plataforma') {
      // A una cuenta de empresa no se le da acceso a la plataforma: debe ser un correo nuevo
      const { rows } = await client.query<{ id_usuario: number }>(
        `INSERT INTO usuarios (id_empresa, nombre, correo, contrasena_hash, rol)
         VALUES (NULL, $1, $2, $3, 'plataforma') RETURNING id_usuario`,
        [nombre, email, await hashContrasena(clave!)],
      );
      alta = { idUsuario: rows[0].id_usuario, existente: false };
    } else {
      alta = await agregarAEmpresa(client, { nombre, correo: email, contrasena: clave, rol, idEmpresa: idEmpresa! });
    }
    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    if ((error as { code?: string }).code === '23505') throw new HttpError(409, 'Ya existe una cuenta con ese correo');
    throw error;
  } finally {
    client.release();
  }
  res.status(201).json({ ...(await buscar(req, alta.idUsuario, idEmpresa ?? undefined)), cuenta_existente: alta.existente });
});

// PATCH /api/usuarios/:id - { nombre?, correo?, rol?, estado?, contrasena?, id_empresa? }
//  - rol y estado son los de una empresa: la propia para un admin; para la plataforma, la de
//    id_empresa (se puede omitir si la persona está en una sola). Sin id_empresa, el estado de
//    quien está en varias o en la plataforma es el de toda la cuenta.
//  - nombre, correo y contrasena son de la cuenta: un admin solo los cambia si la persona
//    está únicamente en su empresa. Si no, podría entrar como ella a las demás.
// Nadie puede desactivarse ni cambiarse el rol en la empresa que tiene abierta, para no
// quedarse sin acceso.
usuarios.patch('/:id', async (req, res) => {
  const s = sesion(req);
  const id = idRuta(req, 'Usuario');
  const b = cuerpo(req);
  const pedida = s.rol === 'plataforma' ? entero(b, 'id_empresa', { min: 1 }) : undefined;
  const actual = await buscar(req, id, pedida);

  const nombre = texto(b, 'nombre', { min: 2, max: 100 });
  const email = correo(b, 'correo');
  const estado = booleano(b, 'estado');
  const clave = contrasena(b, 'contrasena');
  const rol = opcion(b, 'rol', ROLES);
  const cambiaRol = rol !== undefined && rol !== actual.rol;
  if ([nombre, email, estado, clave].every((v) => v === undefined) && !cambiaRol) {
    throw new HttpError(400, 'Envía al menos un campo: nombre, correo, rol, estado o contrasena');
  }

  // Empresa a la que se aplican rol y estado; null = toda la cuenta
  const todaLaCuenta = s.rol === 'plataforma' && pedida === undefined && actual.cuenta_compartida;
  const empresa = todaLaCuenta ? null : actual.id_empresa;
  const esPropia = id === s.id_usuario && (empresa === null || empresa === (s.empresa?.id_empresa ?? null));

  if (cambiaRol) {
    if (esPropia) throw new HttpError(400, 'No puedes cambiar tu propio rol');
    if (rol === 'plataforma' || actual.rol === 'plataforma') {
      throw new HttpError(400, 'El rol plataforma no se asigna ni se quita: crea un usuario nuevo');
    }
    if (empresa === null) throw new HttpError(400, 'Está en varias empresas: indica id_empresa');
  }
  if (estado === false && esPropia) throw new HttpError(400, 'No puedes desactivar tu propia cuenta');
  const cambiaCuenta = nombre !== undefined || email !== undefined || clave !== undefined;
  if (cambiaCuenta && s.rol !== 'plataforma' && id !== s.id_usuario && actual.cuenta_compartida) {
    throw new HttpError(403, 'Esta persona también usa su cuenta en otro lugar: aquí solo puedes cambiar su rol o su estado');
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const cuenta: [string, unknown][] = [];
    if (nombre !== undefined) cuenta.push(['nombre', nombre]);
    if (email !== undefined) cuenta.push(['correo', email]);
    if (clave !== undefined) cuenta.push(['contrasena_hash', await hashContrasena(clave)]);
    if (estado !== undefined && empresa === null) cuenta.push(['estado', estado]);
    // Reactivar en una empresa también reactiva la cuenta, si quien lo pide la administra completa
    if (estado === true && empresa !== null) {
      if (s.rol === 'plataforma' || !actual.cuenta_compartida) cuenta.push(['estado', true]);
      else {
        const { rowCount } = await client.query('SELECT 1 FROM usuarios WHERE id_usuario = $1 AND estado', [id]);
        if (!rowCount) throw new HttpError(409, 'Esa cuenta está desactivada: pide a la plataforma que la reactive');
      }
    }
    if (cuenta.length) {
      await client.query(
        `UPDATE usuarios SET ${cuenta.map(([c], i) => `${c} = $${i + 1}`).join(', ')} WHERE id_usuario = $${cuenta.length + 1}`,
        [...cuenta.map(([, v]) => v), id],
      );
    }
    if (empresa !== null && (cambiaRol || estado !== undefined)) {
      await client.query(
        'UPDATE usuarios_empresas SET rol = coalesce($3, rol), estado = coalesce($4, estado) WHERE id_usuario = $1 AND id_empresa = $2',
        [id, empresa, cambiaRol ? rol : null, estado ?? null],
      );
    }
    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    if ((error as { code?: string }).code === '23505') throw new HttpError(409, 'Ya existe una cuenta con ese correo');
    throw error;
  } finally {
    client.release();
  }
  // Contraseña nueva o cuenta desactivada: se cierran sus sesiones en todos los dispositivos (si
  // es la propia cuenta, se conserva la del dispositivo que hizo el cambio). Al salir de una sola
  // empresa no hace falta: su token de esa empresa deja de servir y sigue en las demás.
  if (clave !== undefined || (estado === false && empresa === null)) {
    await revocarSesionesDeUsuario(id, id === s.id_usuario ? (req.familia ?? undefined) : undefined);
  }
  res.json(await buscar(req, id, empresa ?? undefined));
});
