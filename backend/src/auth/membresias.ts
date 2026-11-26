// Pertenencia de los usuarios a las empresas (tabla usuarios_empresas). Una persona tiene una
// sola cuenta (su correo) y puede estar en varias empresas, con un rol en cada una.

import type pg from 'pg';
import { HttpError } from '../errores.js';
import { hashContrasena } from './contrasena.js';

interface Alta {
  nombre: string;
  correo: string;
  /** Obligatoria solo si el correo todavía no tiene cuenta */
  contrasena?: string;
  rol: 'admin' | 'almacen';
  idEmpresa: number;
}

/**
 * Agrega a una persona a la empresa. Si su correo ya tiene cuenta se usa esa, sin cambiarle el
 * nombre ni la contraseña; si no, se crea. Si ya estuvo en la empresa, se reactiva.
 * Se llama dentro de una transacción.
 */
export async function agregarAEmpresa(client: pg.ClientBase, alta: Alta): Promise<{ idUsuario: number; existente: boolean }> {
  const { rows } = await client.query<{ id_usuario: number; estado: boolean }>(
    'SELECT id_usuario, estado FROM usuarios WHERE correo = $1',
    [alta.correo],
  );
  const cuenta = rows[0];
  if (cuenta) {
    if (!cuenta.estado) throw new HttpError(409, 'Esa cuenta está desactivada: pide a la plataforma que la reactive');
    const agregada = await client.query(
      `INSERT INTO usuarios_empresas AS ue (id_usuario, id_empresa, rol) VALUES ($1, $2, $3)
       ON CONFLICT (id_usuario, id_empresa) DO UPDATE SET rol = EXCLUDED.rol, estado = true WHERE NOT ue.estado`,
      [cuenta.id_usuario, alta.idEmpresa, alta.rol],
    );
    if (!agregada.rowCount) throw new HttpError(409, 'Esa persona ya pertenece a la empresa');
    return { idUsuario: cuenta.id_usuario, existente: true };
  }

  if (!alta.contrasena) throw new HttpError(400, 'contrasena es obligatoria: ese correo todavía no tiene cuenta');
  const creada = await client.query<{ id_usuario: number }>(
    `INSERT INTO usuarios (id_empresa, nombre, correo, contrasena_hash, rol)
     VALUES ($1, $2, $3, $4, $5) RETURNING id_usuario`,
    [alta.idEmpresa, alta.nombre, alta.correo, await hashContrasena(alta.contrasena), alta.rol],
  );
  const idUsuario = creada.rows[0].id_usuario;
  await client.query('INSERT INTO usuarios_empresas (id_usuario, id_empresa, rol) VALUES ($1, $2, $3)', [idUsuario, alta.idEmpresa, alta.rol]);
  return { idUsuario, existente: false };
}
