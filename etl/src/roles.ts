// Crea o actualiza el usuario con el que se conecta la API (API_DB_USER /
// API_DB_PASSWORD del .env). Puede leer, insertar y actualizar, pero no borrar
// filas (productos, usuarios y empresas se desactivan con estado = false y los
// movimientos nunca se editan) ni crear, modificar o borrar tablas: eso queda
// para el dueño de la base. Se puede ejecutar las veces que sea necesario;
// también sirve para aplicar un cambio de contraseña de la API.

import pg from 'pg';
import { conexion, requerida } from './config.js';

async function main() {
  const usuario = requerida('API_DB_USER');
  const contrasena = requerida('API_DB_PASSWORD');
  const base = requerida('POSTGRES_DB');
  if (usuario === requerida('POSTGRES_USER')) {
    throw new Error('API_DB_USER debe ser distinto de POSTGRES_USER (el dueño de la base).');
  }

  const client = new pg.Client(conexion());
  await client.connect();
  try {
    const rol = client.escapeIdentifier(usuario);
    const { rowCount } = await client.query('SELECT 1 FROM pg_roles WHERE rolname = $1', [usuario]);
    // CREATE/ALTER ROLE no admiten parámetros ($1): la contraseña se escapa como literal.
    // Un rol nuevo ya es NOSUPERUSER, NOCREATEDB y NOCREATEROLE por defecto; al existir solo
    // se cambia la contraseña (en Neon el dueño de la base no puede alterar otros atributos).
    const clave = `PASSWORD ${client.escapeLiteral(contrasena)}`;
    await client.query(rowCount ? `ALTER ROLE ${rol} ${clave}` : `CREATE ROLE ${rol} LOGIN ${clave}`);
    await client.query(`GRANT CONNECT ON DATABASE ${client.escapeIdentifier(base)} TO ${rol}`);
    await client.query(`GRANT USAGE ON SCHEMA public TO ${rol}`);
    await client.query(`GRANT SELECT, INSERT, UPDATE ON ALL TABLES IN SCHEMA public TO ${rol}`);
    // Las columnas de identidad (id_*) toman su siguiente valor de una secuencia
    await client.query(`GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO ${rol}`);
    // npm run load borra y recrea las tablas: con esto las nuevas tienen los mismos permisos
    await client.query(`ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT, INSERT, UPDATE ON TABLES TO ${rol}`);
    await client.query(`ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT USAGE, SELECT ON SEQUENCES TO ${rol}`);
    console.log(`Usuario ${usuario} ${rowCount ? 'actualizado' : 'creado'}: SELECT, INSERT y UPDATE en ${base} (sin DELETE ni cambios de tablas).`);
  } finally {
    await client.end();
  }
}

main().catch((error) => {
  console.error('Error al configurar el usuario de la API:', error.message);
  process.exitCode = 1;
});
