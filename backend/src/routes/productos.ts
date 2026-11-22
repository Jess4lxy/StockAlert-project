import { Router } from 'express';
import { evaluarAlertas, notificarN8n, type AlertaGenerada } from '../alertas-servicio.js';
import { empresaDe, permitir, sesion } from '../auth/sesion.js';
import { pool } from '../db.js';
import { HttpError, noEncontrado } from '../errores.js';
import { pagina, paginacion } from '../paginacion.js';
import { booleano, cuerpo, decimal, entero, idRuta, opcionQuery, texto, textoNulo } from '../validar.js';

export const productos = Router();

// Cada filtro de la pantalla como condición fija de SQL (nunca texto del usuario)
const ESTADOS: Record<string, string> = {
  reponer: 'stock_actual < stock_minimo OR stock_actual = 0',
  bajo: 'stock_actual > 0 AND stock_actual < stock_minimo',
  agotado: 'stock_actual = 0',
  ok: 'stock_actual > 0 AND stock_actual >= stock_minimo',
};

const COLUMNAS = `
  id_producto, nombre, descripcion, categoria, stock_actual, stock_minimo,
  precio::float8 AS precio, fecha_actualizacion, estado,
  CASE WHEN stock_actual = 0 THEN 'agotado'
       WHEN stock_actual < stock_minimo THEN 'bajo'
       ELSE 'ok' END AS estado_stock`;

async function buscar(idEmpresa: number, id: number) {
  const { rows } = await pool.query(`SELECT ${COLUMNAS} FROM productos WHERE id_producto = $1 AND id_empresa = $2`, [id, idEmpresa]);
  if (!rows[0]) throw noEncontrado('Producto');
  return rows[0];
}

// GET /api/productos?q=&estado=&categoria=&activo=true|false|todos&page=&limit=
// Primero los que tienen mayor faltante contra su mínimo.
productos.get('/', async (req, res) => {
  const idEmpresa = empresaDe(req);
  const q = String(req.query.q ?? '').trim();
  const estado = opcionQuery(req, 'estado', Object.keys(ESTADOS));
  const categoria = String(req.query.categoria ?? '');
  const activo = opcionQuery(req, 'activo', ['true', 'false', 'todos'] as const) ?? 'true';
  const { page, limit, offset } = paginacion(req);

  const valores: unknown[] = [idEmpresa];
  const condiciones = ['id_empresa = $1'];
  if (activo !== 'todos') condiciones.push(activo === 'true' ? 'estado' : 'NOT estado');
  if (q) {
    valores.push(`%${q}%`);
    condiciones.push(`nombre ILIKE $${valores.length}`);
  }
  if (estado) condiciones.push(`(${ESTADOS[estado]})`);
  if (categoria) {
    valores.push(categoria);
    condiciones.push(`categoria = $${valores.length}`);
  }
  const where = `WHERE ${condiciones.join(' AND ')}`;

  const [total, filas] = await Promise.all([
    pool.query<{ total: number }>(`SELECT count(*)::int AS total FROM productos ${where}`, valores),
    pool.query(
      `SELECT ${COLUMNAS} FROM productos ${where}
       ORDER BY stock_minimo - stock_actual DESC, nombre
       LIMIT $${valores.length + 1} OFFSET $${valores.length + 2}`,
      [...valores, limit, offset],
    ),
  ]);
  res.json(pagina(filas.rows, total.rows[0].total, page, limit));
});

// GET /api/productos/:id
productos.get('/:id', async (req, res) => {
  res.json(await buscar(empresaDe(req), idRuta(req, 'Producto')));
});

// POST /api/productos - { nombre, descripcion?, categoria?, precio, stock_minimo, stock_inicial? }
// El stock inicial se registra como un movimiento de entrada para que el historial cuadre.
productos.post('/', permitir('admin'), async (req, res) => {
  const s = sesion(req);
  const idEmpresa = empresaDe(req);
  const b = cuerpo(req);
  const nombre = texto(b, 'nombre', { requerido: true, max: 150 })!;
  const descripcion = texto(b, 'descripcion', { max: 2000 }) ?? null;
  const categoria = texto(b, 'categoria', { max: 80 }) ?? null;
  const precio = decimal(b, 'precio', { requerido: true, min: 0 })!;
  const stockMinimo = entero(b, 'stock_minimo', { requerido: true, min: 0 })!;
  const stockInicial = entero(b, 'stock_inicial', { min: 0 }) ?? 0;

  const client = await pool.connect();
  let id: number;
  let alerta: AlertaGenerada | null;
  try {
    await client.query('BEGIN');
    const { rows } = await client.query<{ id_producto: number }>(
      `INSERT INTO productos (id_empresa, nombre, descripcion, categoria, precio, stock_minimo, stock_actual)
       VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id_producto`,
      [idEmpresa, nombre, descripcion, categoria, precio, stockMinimo, stockInicial],
    );
    id = rows[0].id_producto;
    if (stockInicial > 0) {
      await client.query(
        `INSERT INTO movimientos (id_producto, id_usuario, tipo_movimiento, cantidad, observaciones)
         VALUES ($1, $2, 'entrada', $3, 'Inventario inicial')`,
        [id, s.id_usuario, stockInicial],
      );
    }
    ({ generada: alerta } = await evaluarAlertas(client, { id_producto: id, stock_actual: stockInicial, stock_minimo: stockMinimo }, null));
    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }

  const producto = await buscar(idEmpresa, id);
  if (alerta) await notificarN8n(alerta, idEmpresa);
  res.status(201).json({ ...producto, alerta_generada: alerta });
});

// PATCH /api/productos/:id - { nombre?, descripcion?, categoria?, precio?, stock_minimo?, estado? }
// El stock no se edita aquí: cambia solo con movimientos (entrada, salida o ajuste).
productos.patch('/:id', permitir('admin'), async (req, res) => {
  const s = sesion(req);
  const idEmpresa = empresaDe(req);
  const id = idRuta(req, 'Producto');
  const b = cuerpo(req);
  if ('stock_actual' in b) throw new HttpError(400, 'El stock no se edita directamente: registra un movimiento de ajuste');

  const cambios: [string, unknown][] = [];
  const nombre = texto(b, 'nombre', { max: 150 });
  const descripcion = textoNulo(b, 'descripcion', 2000);
  const categoria = textoNulo(b, 'categoria', 80);
  const precio = decimal(b, 'precio', { min: 0 });
  const stockMinimo = entero(b, 'stock_minimo', { min: 0 });
  const estado = booleano(b, 'estado');
  if (nombre !== undefined) cambios.push(['nombre', nombre]);
  if (descripcion !== undefined) cambios.push(['descripcion', descripcion]);
  if (categoria !== undefined) cambios.push(['categoria', categoria]);
  if (precio !== undefined) cambios.push(['precio', precio]);
  if (stockMinimo !== undefined) cambios.push(['stock_minimo', stockMinimo]);
  if (estado !== undefined) cambios.push(['estado', estado]);
  if (!cambios.length) throw new HttpError(400, 'Envía al menos un campo: nombre, descripcion, categoria, precio, stock_minimo o estado');

  const client = await pool.connect();
  let alerta: AlertaGenerada | null = null;
  try {
    await client.query('BEGIN');
    const { rows } = await client.query<{ id_producto: number; stock_actual: number; stock_minimo: number }>(
      `UPDATE productos SET ${cambios.map(([c], i) => `${c} = $${i + 1}`).join(', ')}, fecha_actualizacion = now()
       WHERE id_producto = $${cambios.length + 1} AND id_empresa = $${cambios.length + 2}
       RETURNING id_producto, stock_actual, stock_minimo`,
      [...cambios.map(([, v]) => v), id, idEmpresa],
    );
    if (!rows[0]) throw noEncontrado('Producto');
    // Un nuevo mínimo puede dejar el producto por debajo (alerta) o por encima (se atienden)
    if (stockMinimo !== undefined) ({ generada: alerta } = await evaluarAlertas(client, rows[0], rows[0].stock_actual));
    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }

  const producto = await buscar(idEmpresa, id);
  if (alerta) await notificarN8n(alerta, idEmpresa);
  res.json({ ...producto, alerta_generada: alerta });
});

// DELETE /api/productos/:id - lo desactiva (estado = false); su historial se conserva
productos.delete('/:id', permitir('admin'), async (req, res) => {
  const { rowCount } = await pool.query(
    'UPDATE productos SET estado = false, fecha_actualizacion = now() WHERE id_producto = $1 AND id_empresa = $2',
    [idRuta(req, 'Producto'), empresaDe(req)],
  );
  if (!rowCount) throw noEncontrado('Producto');
  res.status(204).end();
});
