// Tokens de acceso (JWT, 15 min) y control de acceso. El token lleva el id del usuario
// y la familia de su sesión (ver auth/refresh.ts); en cada petición se leen de la base
// su rol, su empresa y si siguen activos, así que desactivar a alguien o cambiarle el
// rol aplica de inmediato.

import type { NextFunction, Request, RequestHandler, Response } from 'express';
import jwt from 'jsonwebtoken';
import { config } from '../config.js';
import { pool } from '../db.js';
import { HttpError } from '../errores.js';

export const ROLES = ['plataforma', 'admin', 'almacen'] as const;
export type Rol = (typeof ROLES)[number];

export interface UsuarioSesion {
  id_usuario: number;
  nombre: string;
  correo: string;
  rol: Rol;
  empresa: { id_empresa: number; nombre: string } | null;
}

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      usuario?: UsuarioSesion;
      /** Familia de la sesión del token (null en tokens emitidos antes de los refresh tokens) */
      familia?: string | null;
    }
  }
}

export function firmarToken(idUsuario: number, familia: string): string {
  return jwt.sign({ fam: familia }, config.jwt.secreto, {
    subject: String(idUsuario),
    expiresIn: config.jwt.expira,
    algorithm: 'HS256',
  });
}

// Usuario activo de una empresa activa (o de la plataforma), con los datos que ve el cliente.
// Con familia, además exige que esa sesión siga abierta (cerrar sesión invalida el token
// de acceso de inmediato, sin esperar a que expire).
export async function cargarUsuario(idUsuario: number, familia: string | null = null): Promise<UsuarioSesion | null> {
  const { rows } = await pool.query<{
    id_usuario: number;
    nombre: string;
    correo: string;
    rol: Rol;
    id_empresa: number | null;
    empresa: string | null;
  }>(
    `SELECT u.id_usuario, u.nombre, u.correo, u.rol, u.id_empresa, e.nombre AS empresa
     FROM usuarios u
     LEFT JOIN empresas e ON e.id_empresa = u.id_empresa
     WHERE u.id_usuario = $1 AND u.estado AND (u.id_empresa IS NULL OR e.estado)
       AND ($2::uuid IS NULL OR EXISTS (
             SELECT 1 FROM sesiones s WHERE s.familia = $2::uuid AND s.fecha_revocacion IS NULL))`,
    [idUsuario, familia],
  );
  const u = rows[0];
  if (!u) return null;
  return {
    id_usuario: u.id_usuario,
    nombre: u.nombre,
    correo: u.correo,
    rol: u.rol,
    empresa: u.id_empresa === null ? null : { id_empresa: u.id_empresa, nombre: u.empresa! },
  };
}

// Exige el encabezado Authorization: Bearer <token>
export const autenticar: RequestHandler = async (req, _res, next) => {
  const [tipo, token] = (req.headers.authorization ?? '').split(' ');
  if (tipo !== 'Bearer' || !token) throw new HttpError(401, 'Inicia sesión: falta el token (Authorization: Bearer <token>)');
  let id: number;
  let familia: string | null = null;
  try {
    const datos = jwt.verify(token, config.jwt.secreto, { algorithms: ['HS256'] });
    id = Number(typeof datos === 'object' ? datos.sub : NaN);
    if (typeof datos === 'object' && typeof datos.fam === 'string') familia = datos.fam;
  } catch {
    // El cliente debe pedir un token nuevo con POST /api/auth/refresh
    throw new HttpError(401, 'El token de acceso expiró o no es válido. Renuévalo con /api/auth/refresh.');
  }
  const usuario = Number.isInteger(id) ? await cargarUsuario(id, familia) : null;
  if (!usuario) throw new HttpError(401, 'El usuario ya no tiene acceso. Inicia sesión de nuevo.');
  req.usuario = usuario;
  req.familia = familia;
  next();
};

export function sesion(req: Request): UsuarioSesion {
  if (!req.usuario) throw new HttpError(401, 'Inicia sesión');
  return req.usuario;
}

export const permitir =
  (...roles: Rol[]): RequestHandler =>
  (req: Request, _res: Response, next: NextFunction) => {
    if (!roles.includes(sesion(req).rol)) throw new HttpError(403, 'Tu rol no tiene permiso para esta acción');
    next();
  };

// Empresa del usuario. Los datos de inventario siempre se filtran por ella.
export function empresaDe(req: Request): number {
  const empresa = sesion(req).empresa;
  if (!empresa) {
    throw new HttpError(403, 'Los administradores de la plataforma no tienen inventario: inicia sesión con un usuario de la empresa');
  }
  return empresa.id_empresa;
}
