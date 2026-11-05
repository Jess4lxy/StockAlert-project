import { Router } from 'express';
import { pool } from '../db.js';

export const productos = Router();

const LIMITES = [10, 20, 50, 100];
// Cada filtro de la pantalla como condición fija de SQL (nunca texto del usuario)
const ESTADOS: Record<string, string> = {
  reponer: 'stock_actual < stock_minimo OR stock_actual = 0',
  bajo: 'stock_actual > 0 AND stock_actual < stock_minimo',
  agotado: 'stock_actual = 0',
  ok: 'stock_actual > 0 AND stock_actual >= stock_minimo',
};

// GET /api/productos?q=&estado=&categoria=&page=&limit=
// Catálogo de productos activos; primero los que tienen mayor faltante contra su mínimo.
productos.get('/', async (req, res) => {
  const q = String(req.query.q ?? '').trim();
  const estado = String(req.query.estado ?? '');
  const categoria = String(req.query.categoria ?? '');
  const limit = LIMITES.includes(Number(req.query.limit)) ? Number(req.query.limit) : 20;
  const page = Math.max(1, Math.floor(Number(req.query.page)) || 1);

  if (estado && !Object.hasOwn(ESTADOS, estado)) {
    res.status(400).json({ error: `estado debe ser uno de: ${Object.keys(ESTADOS).join(', ')}` });
    return;
  }

  const condiciones = ['estado'];
  const valores: unknown[] = [];
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
      `SELECT id_producto, nombre, categoria, stock_actual, stock_minimo,
              precio::float8 AS precio, fecha_actualizacion,
              CASE WHEN stock_actual = 0 THEN 'agotado'
                   WHEN stock_actual < stock_minimo THEN 'bajo'
                   ELSE 'ok' END AS estado_stock
       FROM productos
       ${where}
       ORDER BY stock_minimo - stock_actual DESC, nombre
       LIMIT $${valores.length + 1} OFFSET $${valores.length + 2}`,
      [...valores, limit, (page - 1) * limit],
    ),
  ]);

  const registros = total.rows[0].total;
  res.json({
    data: filas.rows,
    page,
    limit,
    total: registros,
    totalPages: Math.max(1, Math.ceil(registros / limit)),
  });
});
