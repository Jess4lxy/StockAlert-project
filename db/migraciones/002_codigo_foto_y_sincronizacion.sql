-- StockAlert - migración 002: código de barras, foto y sincronización sin conexión.
--
-- Solo agrega columnas e índices; no modifica ni borra datos existentes.

ALTER TABLE productos ADD COLUMN IF NOT EXISTS codigo_barras VARCHAR(64);
-- Foto comprimida por el cliente (máximo 400 KB); se lee solo en GET /productos/:id/foto
ALTER TABLE productos ADD COLUMN IF NOT EXISTS foto BYTEA;
ALTER TABLE productos ADD COLUMN IF NOT EXISTS foto_tipo VARCHAR(30);
ALTER TABLE productos ADD COLUMN IF NOT EXISTS foto_fecha TIMESTAMPTZ;

-- Clave que genera el cliente por cada alta o movimiento. Si un envío se repite (por
-- ejemplo, se perdió la respuesta al sincronizar), la API la reconoce y no lo duplica.
ALTER TABLE productos ADD COLUMN IF NOT EXISTS clave_cliente UUID;
ALTER TABLE movimientos ADD COLUMN IF NOT EXISTS clave_cliente UUID;

-- Un código de barras identifica a un solo producto dentro de cada empresa
CREATE UNIQUE INDEX IF NOT EXISTS productos_codigo_idx
    ON productos (id_empresa, codigo_barras) WHERE codigo_barras IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS productos_clave_cliente_idx
    ON productos (clave_cliente) WHERE clave_cliente IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS movimientos_clave_cliente_idx
    ON movimientos (clave_cliente) WHERE clave_cliente IS NOT NULL;
