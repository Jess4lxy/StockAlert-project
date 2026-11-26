-- StockAlert - migración 003: un usuario puede pertenecer a varias empresas.
--
-- El rol pasa a ser por empresa. En usuarios se conservan id_empresa (su primera empresa,
-- la que se abre al iniciar sesión) y rol (solo distingue a los de la plataforma).
-- No borra nada y se puede correr varias veces.

CREATE TABLE IF NOT EXISTS usuarios_empresas (
    id_usuario      INTEGER      NOT NULL REFERENCES usuarios (id_usuario),
    id_empresa      INTEGER      NOT NULL REFERENCES empresas (id_empresa),
    rol             VARCHAR(30)  NOT NULL CHECK (rol IN ('admin', 'almacen')),
    fecha_registro  TIMESTAMPTZ  NOT NULL DEFAULT now(),
    -- false: ya no entra a esta empresa, pero conserva las demás
    estado          BOOLEAN      NOT NULL DEFAULT true,
    PRIMARY KEY (id_usuario, id_empresa)
);
CREATE INDEX IF NOT EXISTS usuarios_empresas_empresa_idx ON usuarios_empresas (id_empresa);

-- Cada cuenta que ya existía queda en la empresa que tenía
INSERT INTO usuarios_empresas (id_usuario, id_empresa, rol, fecha_registro, estado)
SELECT id_usuario, id_empresa, rol, fecha_registro, estado FROM usuarios WHERE id_empresa IS NOT NULL
ON CONFLICT (id_usuario, id_empresa) DO NOTHING;

-- Empresa abierta en cada sesión: se conserva al renovar el token. NULL = la primera del usuario
ALTER TABLE sesiones ADD COLUMN IF NOT EXISTS id_empresa INTEGER REFERENCES empresas (id_empresa);
