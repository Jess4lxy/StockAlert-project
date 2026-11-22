// Tokens JWT y control de acceso. El token solo lleva el id del usuario: en cada
// petición se leen de la base su rol, su empresa y si siguen activos, así que
// desactivar a alguien o cambiarle el rol aplica de inmediato.

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
    }
  }
}

export function firmarToken(idUsuario: number): string {
  return jwt.sign({}, config.jwt.secreto, {
    subject: String(idUsuario),
    expiresIn: config.jwt.expira,
    algorithm: 'HS256',
  });
}

// Usuario activo de una empresa activa (o de la plataforma), con los datos que ve el cliente
export async function cargarUsuario(idUsuario: number): Promise<UsuarioSesion | null> {
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
     WHERE u.id_usuario = $1 AND u.estado AND (u.id_empresa IS NULL OR e.estado)`,
    [idUsuario],
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
  try {
    const datos = jwt.verify(token, config.jwt.secreto, { algorithms: ['HS256'] });
    id = Number(typeof datos === 'object' ? datos.sub : NaN);
  } catch {
    throw new HttpError(401, 'La sesión expiró o el token no es válido. Inicia sesión de nuevo.');
  }
  const usuario = Number.isInteger(id) ? await cargarUsuario(id) : null;
  if (!usuario) throw new HttpError(401, 'El usuario ya no tiene acceso. Inicia sesión de nuevo.');
  req.usuario = usuario;
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
