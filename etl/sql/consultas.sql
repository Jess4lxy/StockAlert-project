-- StockAlert - consultas de validación después de la carga (Tarea 2).
-- Se pueden ejecutar desde DBeaver/psql o con: npm run queries
-- Las fechas se calculan respecto al último movimiento registrado para que el
-- resultado no cambie según el día en que se ejecuten.

-- @consulta: Productos por debajo de su stock mínimo
SELECT id_producto, nombre, categoria, stock_actual, stock_minimo,
       stock_minimo - stock_actual AS faltante
FROM productos
WHERE estado AND stock_actual < stock_minimo
ORDER BY faltante DESC, nombre;

-- @consulta: Top 10 productos más vendidos en los últimos 90 días
SELECT p.nombre, p.categoria, sum(m.cantidad)::int AS unidades_vendidas, count(*)::int AS salidas
FROM movimientos m
JOIN productos p ON p.id_producto = m.id_producto
WHERE m.tipo_movimiento = 'salida'
  AND m.fecha_movimiento >= (SELECT max(fecha_movimiento) FROM movimientos) - interval '90 days'
GROUP BY p.id_producto, p.nombre, p.categoria
ORDER BY unidades_vendidas DESC
LIMIT 10;

-- @consulta: Unidades que entran y salen por mes
SELECT to_char(date_trunc('month', fecha_movimiento AT TIME ZONE 'America/Merida'), 'YYYY-MM') AS mes,
       sum(cantidad) FILTER (WHERE tipo_movimiento = 'entrada')::int AS entradas,
       sum(cantidad) FILTER (WHERE tipo_movimiento = 'salida')::int AS salidas,
       count(*)::int AS movimientos
FROM movimientos
GROUP BY 1
ORDER BY 1;

-- @consulta: Alertas pendientes por categoría
SELECT p.categoria, count(*)::int AS alertas_pendientes,
       count(*) FILTER (WHERE a.tipo_alerta = 'agotado')::int AS agotados
FROM alertas a
JOIN productos p ON p.id_producto = a.id_producto
WHERE a.estado = 'pendiente'
GROUP BY p.categoria
ORDER BY alertas_pendientes DESC;
