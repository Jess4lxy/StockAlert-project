import { Router } from 'express';
import { pool } from '../db.js';

export const alertas = Router();

const ESTADOS = ['pendiente', 'atendida', 'cerrada'];
const TIPOS = ['stock_bajo', 'agotado'];
const LIMITES = [10, 20, 50, 100];

// GET /api/alertas/resumen - totales para las tarjetas de la pantalla
alertas.get('/resumen', async (_req, res) => {
  const { rows } = await pool.query<{ pendientes: number; total: number }>(`
    SELECT count(*) FILTER (WHERE estado = 'pendiente')::int AS pendientes, count(*)::int AS total
    FROM alertas`);
  res.json(rows[0]);
});

// GET /api/alertas?estado=&tipo=&page=&limit= - de la más reciente a la más antigua
alertas.get('/', async (req, res) => {
  const estado = String(req.query.estado ?? '');
  const tipo = String(req.query.tipo ?? '');
  const limit = LIMITES.includes(Number(req.query.limit)) ? Number(req.query.limit) : 20;
  const page = Math.max(1, Math.floor(Number(req.query.page)) || 1);

  if (estado && !ESTADOS.includes(estado)) {
    res.status(400).json({ error: `estado debe ser uno de: ${ESTADOS.join(', ')}` });
    return;
  }
  if (tipo && !TIPOS.includes(tipo)) {
    res.status(400).json({ error: `tipo debe ser uno de: ${TIPOS.join(', ')}` });
    return;
  }

  const condiciones: string[] = [];
  const valores: unknown[] = [];
  if (estado) {
    valores.push(estado);
    condiciones.push(`a.estado = $${valores.length}`);
  }
  if (tipo) {
    valores.push(tipo);
    condiciones.push(`a.tipo_alerta = $${valores.length}`);
  }
  const where = condiciones.length ? `WHERE ${condiciones.join(' AND ')}` : '';

  const [total, filas] = await Promise.all([
    pool.query<{ total: number }>(`SELECT count(*)::int AS total FROM alertas a ${where}`, valores),
    pool.query(
      `SELECT a.id_alerta::int AS id_alerta, a.id_producto, p.nombre AS producto, p.categoria,
              a.tipo_alerta, a.stock_detectado, a.fecha_generacion, a.estado, a.fecha_atencion
       FROM alertas a
       JOIN productos p ON p.id_producto = a.id_producto
       ${where}
       ORDER BY a.fecha_generacion DESC, a.id_alerta DESC
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
