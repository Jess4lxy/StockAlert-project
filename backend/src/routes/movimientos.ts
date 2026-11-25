import { Router } from 'express';
import { evaluarAlertas, notificarN8n, type AlertaGenerada } from '../alertas-servicio.js';
import { empresaDe, permitir, sesion } from '../auth/sesion.js';
import { pool } from '../db.js';
import { HttpError, noEncontrado } from '../errores.js';
import { pagina, paginacion } from '../paginacion.js';
import { claveCliente, cuerpo, entero, enteroQuery, fechaOperacion, fechaQuery, idRuta, opcion, opcionQuery, texto } from '../validar.js';

export const movimientos = Router();

const TIPOS = ['entrada', 'salida', 'ajuste'] as const;

const COLUMNAS = `
  m.id_movimiento, m.fecha_movimiento, m.tipo_movimiento, m.cantidad, m.observaciones,
  p.id_producto, p.nombre AS producto, p.categoria, u.id_usuario, u.nombre AS usuario`;
const DESDE = `
  FROM movimientos m
  JOIN productos p ON p.id_producto = m.id_producto
  JOIN usuarios u ON u.id_usuario = m.id_usuario`;

// GET /api/movimientos?q=&tipo=&categoria=&id_producto=&desde=&hasta=&page=&limit=
// Búsqueda, filtros y paginación se resuelven en PostgreSQL: el cliente solo
// recibe la página que va a mostrar.
movimientos.get('/', async (req, res) => {
  const idEmpresa = empresaDe(req);
  const q = String(req.query.q ?? '').trim();
  const tipo = opcionQuery(req, 'tipo', TIPOS);
  const categoria = String(req.query.categoria ?? '');
  const idProducto = enteroQuery(req, 'id_producto');
  const desde = fechaQuery(req, 'desde');
  const hasta = fechaQuery(req, 'hasta');
  const { page, limit, offset } = paginacion(req);

  // Condiciones dinámicas siempre con parámetros ($1, $2...), nunca concatenando texto
  const valores: unknown[] = [idEmpresa];
  const condiciones = ['p.id_empresa = $1'];
  const agregar = (sql: (n: number) => string, valor: unknown) => {
    valores.push(valor);
    condiciones.push(sql(valores.length));
  };
  if (q) agregar((n) => `p.nombre ILIKE $${n}`, `%${q}%`);
  if (tipo) agregar((n) => `m.tipo_movimiento = $${n}`, tipo);
  if (categoria) agregar((n) => `p.categoria = $${n}`, categoria);
  if (idProducto) agregar((n) => `m.id_producto = $${n}`, idProducto);
  // Una fecha sin hora (2026-10-01) se toma en la hora de Mérida y "hasta" incluye todo ese día
  const dia = (n: number, dias = 0) => `(($${n}::date + ${dias})::timestamp AT TIME ZONE 'America/Merida')`;
  if (desde) agregar((n) => `m.fecha_movimiento >= ${desde.length === 10 ? dia(n) : `$${n}`}`, desde);
  if (hasta) agregar((n) => (hasta.length === 10 ? `m.fecha_movimiento < ${dia(n, 1)}` : `m.fecha_movimiento <= $${n}`), hasta);
  const where = `WHERE ${condiciones.join(' AND ')}`;

  const inicio = performance.now();
  const [total, filas] = await Promise.all([
    pool.query<{ total: number }>(`SELECT count(*)::int AS total ${DESDE} ${where}`, valores),
    pool.query(
      `SELECT ${COLUMNAS} ${DESDE} ${where}
       ORDER BY m.fecha_movimiento DESC, m.id_movimiento DESC
       LIMIT $${valores.length + 1} OFFSET $${valores.length + 2}`,
      [...valores, limit, offset],
    ),
  ]);
  // Tiempo de las consultas en PostgreSQL; lo usa la prueba de rendimiento (Tarea 3)
  res.set('Server-Timing', `db;dur=${(performance.now() - inicio).toFixed(2)}`);
  res.json(pagina(filas.rows, total.rows[0].total, page, limit));
});

// GET /api/movimientos/:id
movimientos.get('/:id', async (req, res) => {
  const { rows } = await pool.query(`SELECT ${COLUMNAS} ${DESDE} WHERE m.id_movimiento = $1 AND p.id_empresa = $2`, [
    idRuta(req, 'Movimiento'),
    empresaDe(req),
  ]);
  if (!rows[0]) throw noEncontrado('Movimiento');
  res.json(rows[0]);
});

// POST /api/movimientos
// { id_producto, tipo_movimiento, cantidad, observaciones?, clave_cliente?, fecha_movimiento? }
// En una sola transacción: registra el movimiento, actualiza el stock del producto y
// genera o atiende alertas. Los movimientos no se editan ni se borran: un error se
// corrige con un ajuste.
// Los registrados sin conexión traen clave_cliente (si ya se recibió, responde 200 con el
// mismo movimiento y no lo aplica otra vez) y fecha_movimiento (cuándo ocurrió).
movimientos.post('/', permitir('admin', 'almacen'), async (req, res) => {
  const s = sesion(req);
  const idEmpresa = empresaDe(req);
  const b = cuerpo(req);
  const idProducto = entero(b, 'id_producto', { requerido: true, min: 1 })!;
  const tipo = opcion(b, 'tipo_movimiento', TIPOS, { requerido: true })!;
  const cantidad = entero(b, 'cantidad', { requerido: true, min: tipo === 'ajuste' ? -1_000_000 : 1, max: 1_000_000 })!;
  if (cantidad === 0) throw new HttpError(400, 'cantidad no puede ser 0');
  const observaciones = texto(b, 'observaciones', { max: 500 }) ?? null;
  const clave = claveCliente(b);
  const fecha = fechaOperacion(b, 'fecha_movimiento');
  const delta = tipo === 'salida' ? -cantidad : cantidad;

  const client = await pool.connect();
  let alerta: AlertaGenerada | null = null;
  let atendidas = 0;
  let repetido = false;
  let idMovimiento: number;
  let producto: { id_producto: number; nombre: string; categoria: string | null; stock_actual: number; stock_minimo: number };
  try {
    await client.query('BEGIN');
    // FOR UPDATE: dos movimientos simultáneos del mismo producto se aplican uno tras otro
    const { rows } = await client.query<{ stock_actual: number; estado: boolean }>(
      'SELECT stock_actual, estado FROM productos WHERE id_producto = $1 AND id_empresa = $2 FOR UPDATE',
      [idProducto, idEmpresa],
    );
    if (!rows[0]) throw noEncontrado('Producto');

    const previo = clave
      ? await client.query<{ id_movimiento: number; id_producto: number }>(
          'SELECT id_movimiento::int AS id_movimiento, id_producto FROM movimientos WHERE clave_cliente = $1',
          [clave],
        )
      : null;
    if (previo?.rows[0]) {
      if (previo.rows[0].id_producto !== idProducto) throw new HttpError(409, 'clave_cliente ya está en uso');
      repetido = true;
      idMovimiento = previo.rows[0].id_movimiento;
      const p = await client.query<typeof producto>(
        'SELECT id_producto, nombre, categoria, stock_actual, stock_minimo FROM productos WHERE id_producto = $1',
        [idProducto],
      );
      producto = p.rows[0];
    } else {
      if (!rows[0].estado) throw new HttpError(409, 'El producto está desactivado');
      const anterior = rows[0].stock_actual;
      if (anterior + delta < 0) {
        throw new HttpError(409, `Stock insuficiente: hay ${anterior} y el movimiento resta ${-delta}`);
      }
      const m = await client.query<{ id_movimiento: number }>(
        `INSERT INTO movimientos (id_producto, id_usuario, tipo_movimiento, cantidad, observaciones, clave_cliente, fecha_movimiento)
         VALUES ($1, $2, $3, $4, $5, $6, coalesce($7::timestamptz, now())) RETURNING id_movimiento::int AS id_movimiento`,
        [idProducto, s.id_usuario, tipo, cantidad, observaciones, clave, fecha],
      );
      idMovimiento = m.rows[0].id_movimiento;
      const p = await client.query<typeof producto>(
        `UPDATE productos SET stock_actual = stock_actual + $1, fecha_actualizacion = now()
         WHERE id_producto = $2
         RETURNING id_producto, nombre, categoria, stock_actual, stock_minimo`,
        [delta, idProducto],
      );
      producto = p.rows[0];
      ({ generada: alerta, atendidas } = await evaluarAlertas(client, producto, anterior));
    }
    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }

  const { rows } = await pool.query(`SELECT ${COLUMNAS} ${DESDE} WHERE m.id_movimiento = $1`, [idMovimiento]);
  const n8n = alerta ? await notificarN8n(alerta, idEmpresa) : false;
  res.status(repetido ? 200 : 201).json({
    movimiento: rows[0],
    producto: {
      ...producto,
      estado_stock: producto.stock_actual === 0 ? 'agotado' : producto.stock_actual < producto.stock_minimo ? 'bajo' : 'ok',
    },
    alerta_generada: alerta,
    alertas_atendidas: atendidas,
    n8n_notificado: n8n,
  });
});
