// Crea o actualiza los dos administradores de la plataforma con los datos del .env
// (ADMIN1_* y ADMIN2_*). No pertenecen a ninguna empresa: desde su pantalla crean
// empresas y usuarios. Como npm run load recrea las tablas, este paso va dentro de
// npm run etl; también sirve para cambiarles la contraseña.

import pg from 'pg';
import { conexion, requerida } from './config.js';
import { hashContrasena } from './contrasena.js';

const ADMINS = [1, 2].map((n) => ({
  nombre: requerida(`ADMIN${n}_NOMBRE`),
  correo: requerida(`ADMIN${n}_CORREO`).trim().toLowerCase(),
  contrasena: requerida(`ADMIN${n}_CONTRASENA`),
}));

async function main() {
  for (const a of ADMINS) {
    if (a.contrasena.length < 12) throw new Error(`La contraseña de ${a.correo} debe tener al menos 12 caracteres.`);
  }
  if (ADMINS[0].correo === ADMINS[1].correo) throw new Error('ADMIN1_CORREO y ADMIN2_CORREO deben ser distintos.');

  const client = new pg.Client(conexion());
  await client.connect();
  try {
    for (const a of ADMINS) {
      const { rows } = await client.query<{ creado: boolean }>(
        `INSERT INTO usuarios (id_empresa, nombre, correo, contrasena_hash, rol)
         VALUES (NULL, $1, $2, $3, 'plataforma')
         ON CONFLICT (correo) DO UPDATE
           SET nombre = EXCLUDED.nombre, contrasena_hash = EXCLUDED.contrasena_hash,
               rol = 'plataforma', id_empresa = NULL, estado = true
         RETURNING (xmax = 0) AS creado`,
        [a.nombre, a.correo, hashContrasena(a.contrasena)],
      );
      console.log(`Administrador de plataforma ${a.correo} ${rows[0].creado ? 'creado' : 'actualizado'}.`);
    }
  } finally {
    await client.end();
  }
}

main().catch((error) => {
  console.error('Error al crear los administradores de la plataforma:', error.message);
  process.exitCode = 1;
});
