import express, { Router } from 'express';
import { evaluarAlertas, notificarN8n, type AlertaGenerada } from '../alertas-servicio.js';
import { empresaDe, permitir, sesion } from '../auth/sesion.js';
import { pool } from '../db.js';
import { HttpError, noEncontrado } from '../errores.js';
import { pagina, paginacion } from '../paginacion.js';
import { booleano, claveCliente, codigoBarras, cuerpo, decimal, entero, idRuta, opcionQuery, texto, textoNulo } from '../validar.js';

export const productos = Router();

// Cada filtro de la pantalla como condición fija de SQL (nunca texto del usuario)
const ESTADOS: Record<string, string> = {
  reponer: 'stock_actual < stock_minimo OR stock_actual = 0',
  bajo: 'stock_actual > 0 AND stock_actual < stock_minimo',
  agotado: 'stock_actual = 0',
  ok: 'stock_actual > 0 AND stock_actual >= stock_minimo',
};

// La foto no viaja en los listados: foto_fecha indica si hay una y cuándo cambió
const COLUMNAS = `
  id_producto, nombre, descripcion, categoria, codigo_barras, stock_actual, stock_minimo,
  precio::float8 AS precio, fecha_actualizacion, estado, foto_fecha,
  CASE WHEN stock_actual = 0 THEN 'agotado'
       WHEN stock_actual < stock_minimo THEN 'bajo'
       ELSE 'ok' END AS estado_stock`;

const FOTO_MAX = '400kb';

async function buscar(idEmpresa: number, id: number) {
  const { rows } = await pool.query(`SELECT ${COLUMNAS} FROM productos WHERE id_producto = $1 AND id_empresa = $2`, [id, idEmpresa]);
  if (!rows[0]) throw noEncontrado('Producto');
  return rows[0];
}

// Un código repetido llega como violación del índice único de la empresa
function errorDeCodigo(error: unknown): unknown {
  const e = error as { code?: string; constraint?: string };
  return e.code === '23505' && e.constraint === 'productos_codigo_idx'
    ? new HttpError(409, 'Otro producto ya tiene ese código de barras')
    : error;
}

// GET /api/productos?q=&estado=&categoria=&codigo=&activo=true|false|todos&page=&limit=
// Primero los que tienen mayor faltante contra su mínimo.
productos.get('/', async (req, res) => {
  const idEmpresa = empresaDe(req);
  const q = String(req.query.q ?? '').trim();
  const estado = opcionQuery(req, 'estado', Object.keys(ESTADOS));
  const categoria = String(req.query.categoria ?? '');
  const codigo = String(req.query.codigo ?? '').trim();
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
  if (codigo) {
    valores.push(codigo);
    condiciones.push(`codigo_barras = $${valores.length}`);
  }
  const where = `WHERE ${condiciones.join(' AND ')}`;

  const [total, filas] = await Promise.all([
    pool.query<{ total: number }>(`SELECT count(*)::int AS total FROM productos ${where}`, valores),
    pool.query(
      `SELECT ${COLUMNAS} FROM productos ${where}
       ORDER BY stock_minimo - stock_actual DESC, nombre, id_producto
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

// POST /api/productos
// { nombre, descripcion?, categoria?, codigo_barras?, precio, stock_minimo, stock_inicial?, clave_cliente? }
// El stock inicial se registra como un movimiento de entrada para que el historial cuadre.
// Con una clave_cliente ya usada responde 200 con el producto existente (reenvío).
productos.post('/', permitir('admin'), async (req, res) => {
  const s = sesion(req);
  const idEmpresa = empresaDe(req);
  const b = cuerpo(req);
  const nombre = texto(b, 'nombre', { requerido: true, max: 150 })!;
  const descripcion = texto(b, 'descripcion', { max: 2000 }) ?? null;
  const categoria = texto(b, 'categoria', { max: 80 }) ?? null;
  const codigo = codigoBarras(b) ?? null;
  const precio = decimal(b, 'precio', { requerido: true, min: 0 })!;
  const stockMinimo = entero(b, 'stock_minimo', { requerido: true, min: 0 })!;
  const stockInicial = entero(b, 'stock_inicial', { min: 0 }) ?? 0;
  const clave = claveCliente(b);

  const client = await pool.connect();
  let id: number;
  let alerta: AlertaGenerada | null;
  try {
    await client.query('BEGIN');
    const { rows } = await client.query<{ id_producto: number }>(
      `INSERT INTO productos (id_empresa, nombre, descripcion, categoria, codigo_barras, precio, stock_minimo, stock_actual, clave_cliente)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       ON CONFLICT (clave_cliente) WHERE clave_cliente IS NOT NULL DO NOTHING
       RETURNING id_producto`,
      [idEmpresa, nombre, descripcion, categoria, codigo, precio, stockMinimo, stockInicial, clave],
    );
    if (!rows[0]) {
      const previo = await client.query<{ id_producto: number }>(
        'SELECT id_producto FROM productos WHERE clave_cliente = $1 AND id_empresa = $2',
        [clave, idEmpresa],
      );
      await client.query('COMMIT');
      if (!previo.rows[0]) throw new HttpError(409, 'clave_cliente ya está en uso');
      res.json({ ...(await buscar(idEmpresa, previo.rows[0].id_producto)), alerta_generada: null });
      return;
    }
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
    throw errorDeCodigo(error);
  } finally {
    client.release();
  }

  const producto = await buscar(idEmpresa, id);
  if (alerta) await notificarN8n(alerta, idEmpresa);
  res.status(201).json({ ...producto, alerta_generada: alerta });
});

// PATCH /api/productos/:id
// { nombre?, descripcion?, categoria?, codigo_barras?, precio?, stock_minimo?, estado? }
// El stock no se edita aquí: cambia solo con movimientos (entrada, salida o ajuste).
productos.patch('/:id', permitir('admin'), async (req, res) => {
  const idEmpresa = empresaDe(req);
  const id = idRuta(req, 'Producto');
  const b = cuerpo(req);
  if ('stock_actual' in b) throw new HttpError(400, 'El stock no se edita directamente: registra un movimiento de ajuste');

  const cambios: [string, unknown][] = [];
  const nombre = texto(b, 'nombre', { max: 150 });
  const descripcion = textoNulo(b, 'descripcion', 2000);
  const categoria = textoNulo(b, 'categoria', 80);
  const codigo = codigoBarras(b);
  const precio = decimal(b, 'precio', { min: 0 });
  const stockMinimo = entero(b, 'stock_minimo', { min: 0 });
  const estado = booleano(b, 'estado');
  if (nombre !== undefined) cambios.push(['nombre', nombre]);
  if (descripcion !== undefined) cambios.push(['descripcion', descripcion]);
  if (categoria !== undefined) cambios.push(['categoria', categoria]);
  if (codigo !== undefined) cambios.push(['codigo_barras', codigo]);
  if (precio !== undefined) cambios.push(['precio', precio]);
  if (stockMinimo !== undefined) cambios.push(['stock_minimo', stockMinimo]);
  if (estado !== undefined) cambios.push(['estado', estado]);
  if (!cambios.length) {
    throw new HttpError(400, 'Envía al menos un campo: nombre, descripcion, categoria, codigo_barras, precio, stock_minimo o estado');
  }

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
    throw errorDeCodigo(error);
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

// Tipo real de la imagen por sus primeros bytes: no se confía en el Content-Type recibido
function tipoDeImagen(datos: Buffer): string | null {
  if (datos.subarray(0, 3).equals(Buffer.from([0xff, 0xd8, 0xff]))) return 'image/jpeg';
  if (datos.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return 'image/png';
  if (datos.subarray(0, 4).toString('latin1') === 'RIFF' && datos.subarray(8, 12).toString('latin1') === 'WEBP') return 'image/webp';
  return null;
}

// PUT /api/productos/:id/foto - el cuerpo es la imagen (JPEG, PNG o WebP, máximo 400 KB)
productos.put(
  '/:id/foto',
  permitir('admin'),
  express.raw({ type: ['image/jpeg', 'image/png', 'image/webp'], limit: FOTO_MAX }),
  async (req, res) => {
    const id = idRuta(req, 'Producto');
    const idEmpresa = empresaDe(req);
    const datos = Buffer.isBuffer(req.body) ? req.body : null;
    const tipo = datos && tipoDeImagen(datos);
    if (!datos || !tipo) throw new HttpError(400, 'Envía una imagen JPEG, PNG o WebP en el cuerpo de la petición');
    const { rowCount } = await pool.query(
      `UPDATE productos SET foto = $1, foto_tipo = $2, foto_fecha = now(), fecha_actualizacion = now()
       WHERE id_producto = $3 AND id_empresa = $4`,
      [datos, tipo, id, idEmpresa],
    );
    if (!rowCount) throw noEncontrado('Producto');
    res.json(await buscar(idEmpresa, id));
  },
);

// GET /api/productos/:id/foto
productos.get('/:id/foto', async (req, res) => {
  const { rows } = await pool.query<{ foto: Buffer | null; foto_tipo: string }>(
    'SELECT foto, foto_tipo FROM productos WHERE id_producto = $1 AND id_empresa = $2',
    [idRuta(req, 'Producto'), empresaDe(req)],
  );
  if (!rows[0]?.foto) throw noEncontrado('Foto');
  res.set({ 'Content-Type': rows[0].foto_tipo, 'Cache-Control': 'private, no-cache', 'X-Content-Type-Options': 'nosniff' });
  res.send(rows[0].foto);
});

// DELETE /api/productos/:id/foto
productos.delete('/:id/foto', permitir('admin'), async (req, res) => {
  const { rowCount } = await pool.query(
    `UPDATE productos SET foto = NULL, foto_tipo = NULL, foto_fecha = NULL, fecha_actualizacion = now()
     WHERE id_producto = $1 AND id_empresa = $2`,
    [idRuta(req, 'Producto'), empresaDe(req)],
  );
  if (!rowCount) throw noEncontrado('Producto');
  res.status(204).end();
});
