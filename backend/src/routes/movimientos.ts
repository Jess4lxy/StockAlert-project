import { Router } from 'express';
import { pool } from '../db.js';

export const movimientos = Router();

const TIPOS = ['entrada', 'salida', 'ajuste'];
const LIMITES = [10, 20, 50, 100];

// GET /api/movimientos?q=&tipo=&categoria=&page=&limit=
// Búsqueda, filtro y paginación se resuelven en PostgreSQL: el navegador solo
// recibe la página que va a mostrar, nunca los 10,000 registros.
movimientos.get('/', async (req, res) => {
  const q = String(req.query.q ?? '').trim();
  const tipo = String(req.query.tipo ?? '');
  const categoria = String(req.query.categoria ?? '');
  const limit = LIMITES.includes(Number(req.query.limit)) ? Number(req.query.limit) : 20;
  const page = Math.max(1, Math.floor(Number(req.query.page)) || 1);

  if (tipo && !TIPOS.includes(tipo)) {
    res.status(400).json({ error: `tipo debe ser uno de: ${TIPOS.join(', ')}` });
    return;
  }

  // Condiciones dinámicas siempre con parámetros ($1, $2...), nunca concatenando texto
  const condiciones: string[] = [];
  const valores: unknown[] = [];
  if (q) {
    valores.push(`%${q}%`);
    condiciones.push(`p.nombre ILIKE $${valores.length}`);
  }
  if (tipo) {
    valores.push(tipo);
    condiciones.push(`m.tipo_movimiento = $${valores.length}`);
  }
  if (categoria) {
    valores.push(categoria);
    condiciones.push(`p.categoria = $${valores.length}`);
  }
  const where = condiciones.length ? `WHERE ${condiciones.join(' AND ')}` : '';
  const desde = `
    FROM movimientos m
    JOIN productos p ON p.id_producto = m.id_producto
    JOIN usuarios u ON u.id_usuario = m.id_usuario
    ${where}`;

  const inicio = performance.now();
  const [total, filas] = await Promise.all([
    pool.query<{ total: number }>(`SELECT count(*)::int AS total ${desde}`, valores),
    pool.query(
      `SELECT m.id_movimiento, m.fecha_movimiento, m.tipo_movimiento, m.cantidad, m.observaciones,
              p.id_producto, p.nombre AS producto, p.categoria, u.nombre AS usuario
       ${desde}
       ORDER BY m.fecha_movimiento DESC, m.id_movimiento DESC
       LIMIT $${valores.length + 1} OFFSET $${valores.length + 2}`,
      [...valores, limit, (page - 1) * limit],
    ),
  ]);
  // Tiempo de las consultas en PostgreSQL; lo usa la prueba de rendimiento (Tarea 3)
  res.set('Server-Timing', `db;dur=${(performance.now() - inicio).toFixed(2)}`);

  const registros = total.rows[0].total;
  res.json({
    data: filas.rows,
    page,
    limit,
    total: registros,
    totalPages: Math.max(1, Math.ceil(registros / limit)),
  });
});
