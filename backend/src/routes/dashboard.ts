import { Router } from 'express';
import { pool } from '../db.js';

export const dashboard = Router();

const PERIODOS = [3, 6, 12];

// GET /api/dashboard?meses=3|6|12
// Indicadores de los últimos N meses calendario, contando el mes del último
// movimiento registrado (con datos sintéticos, "hoy" es el final del historial).
// El periodo anterior son los N meses previos y solo se compara si el historial
// lo cubre completo.
dashboard.get('/', async (req, res) => {
  const meses = PERIODOS.includes(Number(req.query.meses)) ? Number(req.query.meses) : 6;

  const rango = `
    WITH r AS (
      SELECT max(fecha_movimiento) AS fin,
             min(fecha_movimiento) AS primero,
             (date_trunc('month', max(fecha_movimiento) AT TIME ZONE 'America/Merida')
               - make_interval(months => $1 - 1)) AT TIME ZONE 'America/Merida' AS inicio,
             (date_trunc('month', max(fecha_movimiento) AT TIME ZONE 'America/Merida')
               - make_interval(months => $1 * 2 - 1)) AT TIME ZONE 'America/Merida' AS inicio_anterior
      FROM movimientos
    )`;

  const [stock, ventas, porMes, porCategoria, porReponer] = await Promise.all([
    // Métrica 1: productos activos por debajo de su stock mínimo
    pool.query<{ bajo_minimo: number; total: number }>(`
      SELECT count(*) FILTER (WHERE stock_actual < stock_minimo)::int AS bajo_minimo, count(*)::int AS total
      FROM productos WHERE estado`),
    // Métrica 2: unidades vendidas en el periodo y en el anterior
    pool.query<{ actual: number; anterior: number | null; inicio: string; fin: string }>(`
      ${rango}
      SELECT coalesce(sum(m.cantidad) FILTER (WHERE m.fecha_movimiento >= r.inicio), 0)::int AS actual,
             CASE WHEN r.primero <= r.inicio_anterior
                  THEN sum(m.cantidad) FILTER (WHERE m.fecha_movimiento < r.inicio)::int END AS anterior,
             r.inicio, r.fin
      FROM r LEFT JOIN movimientos m
        ON m.tipo_movimiento = 'salida' AND m.fecha_movimiento >= r.inicio_anterior
      GROUP BY r.inicio, r.fin, r.primero, r.inicio_anterior`, [meses]),
    // Entradas y salidas por mes (gráfica)
    pool.query<{ mes: string; entradas: number; salidas: number }>(`
      ${rango}
      SELECT to_char(date_trunc('month', m.fecha_movimiento AT TIME ZONE 'America/Merida'), 'YYYY-MM') AS mes,
             coalesce(sum(m.cantidad) FILTER (WHERE m.tipo_movimiento = 'entrada'), 0)::int AS entradas,
             coalesce(sum(m.cantidad) FILTER (WHERE m.tipo_movimiento = 'salida'), 0)::int AS salidas
      FROM movimientos m, r
      WHERE m.fecha_movimiento >= r.inicio
      GROUP BY 1 ORDER BY 1`, [meses]),
    // Métrica 3: unidades vendidas por categoría en el periodo (gráfica)
    pool.query<{ categoria: string; unidades: number }>(`
      ${rango}
      SELECT p.categoria, sum(m.cantidad)::int AS unidades
      FROM movimientos m JOIN productos p ON p.id_producto = m.id_producto, r
      WHERE m.tipo_movimiento = 'salida' AND m.fecha_movimiento >= r.inicio
      GROUP BY p.categoria ORDER BY unidades DESC`, [meses]),
    // Detalle de la métrica 1 (tabla)
    pool.query(`
      SELECT id_producto, nombre, categoria, stock_actual, stock_minimo, stock_minimo - stock_actual AS faltante
      FROM productos WHERE estado AND stock_actual < stock_minimo
      ORDER BY faltante DESC, nombre`),
  ]);

  const v = ventas.rows[0];
  const totalVendido = porCategoria.rows.reduce((suma, c) => suma + c.unidades, 0);
  const top = porCategoria.rows[0];

  res.json({
    meses,
    periodo: { inicio: v.inicio, fin: v.fin },
    stockBajo: { productos: stock.rows[0].bajo_minimo, total: stock.rows[0].total },
    unidadesVendidas: {
      actual: v.actual,
      anterior: v.anterior,
      // Sin datos del periodo anterior no hay variación que mostrar
      variacion: v.anterior ? (v.actual - v.anterior) / v.anterior : null,
    },
    categoriaTop: top ? { categoria: top.categoria, unidades: top.unidades, participacion: top.unidades / totalVendido } : null,
    porMes: porMes.rows,
    porCategoria: porCategoria.rows,
    porReponer: porReponer.rows,
  });
});
