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

export interface EmpresaDeUsuario {
  id_empresa: number;
  nombre: string;
  rol: Exclude<Rol, 'plataforma'>;
  /** La primera a la que perteneció: se abre al iniciar sesión */
  principal: boolean;
}

export interface UsuarioSesion {
  id_usuario: number;
  nombre: string;
  correo: string;
  rol: Rol;
  /** Empresa abierta en esta sesión; null en la administración de la plataforma */
  empresa: { id_empresa: number; nombre: string } | null;
  /** Empresas a las que puede cambiar con POST /api/auth/empresa */
  empresas: EmpresaDeUsuario[];
  /** También puede administrar la plataforma */
  plataforma: boolean;
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

export function firmarToken(idUsuario: number, familia: string, idEmpresa: number | null): string {
  return jwt.sign({ fam: familia, ...(idEmpresa === null ? {} : { emp: idEmpresa }) }, config.jwt.secreto, {
    subject: String(idUsuario),
    expiresIn: config.jwt.expira,
    algorithm: 'HS256',
  });
}

interface OpcionesCarga {
  /** Exige que esa sesión siga abierta (cerrar sesión invalida el token de acceso de inmediato) */
  familia?: string | null;
  /** Empresa por abrir; null o sin valor: la de inicio (plataforma o su primera empresa) */
  empresa?: number | null;
  /** Si ya no pertenece a esa empresa, no se abre otra en su lugar */
  estricta?: boolean;
}

// Usuario activo con las empresas activas a las que pertenece y la que tiene abierta. El rol
// es el que tiene en esa empresa. Devuelve null si ya no puede entrar a ninguna.
export async function cargarUsuario(idUsuario: number, opc: OpcionesCarga = {}): Promise<UsuarioSesion | null> {
  const { rows } = await pool.query<{ id_usuario: number; nombre: string; correo: string; rol: Rol; empresas: EmpresaDeUsuario[] }>(
    `SELECT u.id_usuario, u.nombre, u.correo, u.rol,
            coalesce((
              SELECT json_agg(json_build_object('id_empresa', e.id_empresa, 'nombre', e.nombre, 'rol', ue.rol,
                                                'principal', e.id_empresa IS NOT DISTINCT FROM u.id_empresa) ORDER BY e.nombre, e.id_empresa)
              FROM usuarios_empresas ue
              JOIN empresas e ON e.id_empresa = ue.id_empresa AND e.estado
              WHERE ue.id_usuario = u.id_usuario AND ue.estado), '[]') AS empresas
     FROM usuarios u
     WHERE u.id_usuario = $1 AND u.estado
       AND ($2::uuid IS NULL OR EXISTS (
             SELECT 1 FROM sesiones s WHERE s.familia = $2::uuid AND s.fecha_revocacion IS NULL))`,
    [idUsuario, opc.familia ?? null],
  );
  const u = rows[0];
  if (!u) return null;
  const plataforma = u.rol === 'plataforma';

  let abierta = typeof opc.empresa === 'number' ? u.empresas.find((e) => e.id_empresa === opc.empresa) : undefined;
  if (!abierta) {
    if (opc.estricta && typeof opc.empresa === 'number') return null;
    if (!plataforma) abierta = u.empresas.find((e) => e.principal) ?? u.empresas[0];
    if (!abierta && !plataforma) return null;
  }
  return {
    id_usuario: u.id_usuario,
    nombre: u.nombre,
    correo: u.correo,
    rol: abierta ? abierta.rol : 'plataforma',
    empresa: abierta ? { id_empresa: abierta.id_empresa, nombre: abierta.nombre } : null,
    empresas: u.empresas,
    plataforma,
  };
}

// Exige el encabezado Authorization: Bearer <token>
export const autenticar: RequestHandler = async (req, _res, next) => {
  const [tipo, token] = (req.headers.authorization ?? '').split(' ');
  if (tipo !== 'Bearer' || !token) throw new HttpError(401, 'Inicia sesión: falta el token (Authorization: Bearer <token>)');
  let id: number;
  let familia: string | null = null;
  let empresa: number | null = null;
  try {
    const datos = jwt.verify(token, config.jwt.secreto, { algorithms: ['HS256'] });
    id = Number(typeof datos === 'object' ? datos.sub : NaN);
    if (typeof datos === 'object' && typeof datos.fam === 'string') familia = datos.fam;
    if (typeof datos === 'object' && typeof datos.emp === 'number') empresa = datos.emp;
  } catch {
    // El cliente debe pedir un token nuevo con POST /api/auth/refresh
    throw new HttpError(401, 'El token de acceso expiró o no es válido. Renuévalo con /api/auth/refresh.');
  }
  const usuario = Number.isInteger(id) ? await cargarUsuario(id, { familia, empresa, estricta: true }) : null;
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
    throw new HttpError(403, 'La administración de la plataforma no tiene inventario: cambia a una empresa');
  }
  return empresa.id_empresa;
}
