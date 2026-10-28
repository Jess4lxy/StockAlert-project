-- StockAlert - optimización de la Tarea 3
--
-- El listado de movimientos (pantalla web y GET /api/movimientos) siempre
-- ordena por fecha descendente y solo pide una página. Sin índice, PostgreSQL
-- lee y ordena los 10,000 movimientos para quedarse con 20. Con este índice
-- recorre los movimientos ya ordenados y se detiene al llenar la página.
CREATE INDEX IF NOT EXISTS movimientos_fecha_idx
    ON movimientos (fecha_movimiento DESC, id_movimiento DESC);

-- La búsqueda por producto une movimientos con productos por id_producto.
-- PostgreSQL no indexa las llaves foráneas por su cuenta; este índice permite
-- traer solo los movimientos de los productos encontrados (y contarlos).
CREATE INDEX IF NOT EXISTS movimientos_producto_fecha_idx
    ON movimientos (id_producto, fecha_movimiento DESC);

-- Actualiza las estadísticas para que el planificador considere los índices nuevos
ANALYZE movimientos;
