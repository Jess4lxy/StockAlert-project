
CREATE INDEX IF NOT EXISTS movimientos_fecha_idx
    ON movimientos (fecha_movimiento DESC, id_movimiento DESC);


CREATE INDEX IF NOT EXISTS movimientos_producto_fecha_idx
    ON movimientos (id_producto, fecha_movimiento DESC);

ANALYZE movimientos;
