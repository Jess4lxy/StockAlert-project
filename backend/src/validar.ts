// Validación de cuerpos JSON y parámetros. Cada función devuelve el valor limpio,
// undefined si el campo no se envió (y no es obligatorio), o lanza un 400.
// En un PATCH, null significa "borrar el valor" en los campos que lo permiten.

import type { Request } from 'express';
import { HttpError, noEncontrado } from './errores.js';

type Cuerpo = Record<string, unknown>;
const malo = (mensaje: string) => new HttpError(400, mensaje);

export function cuerpo(req: Request): Cuerpo {
  const b = req.body;
  if (!b || typeof b !== 'object' || Array.isArray(b)) throw malo('Envía un objeto JSON con Content-Type: application/json');
  return b as Cuerpo;
}

const vacio = (v: unknown) => v === undefined || v === null || v === '';

export function texto(b: Cuerpo, campo: string, opc: { requerido?: boolean; max?: number; min?: number } = {}): string | undefined {
  const v = b[campo];
  if (vacio(v)) {
    if (opc.requerido) throw malo(`${campo} es obligatorio`);
    return undefined;
  }
  if (typeof v !== 'string') throw malo(`${campo} debe ser texto`);
  const t = v.trim();
  if (t.length < (opc.min ?? 1)) throw malo(`${campo} debe tener al menos ${opc.min ?? 1} caracteres`);
  if (t.length > (opc.max ?? 255)) throw malo(`${campo} admite como máximo ${opc.max ?? 255} caracteres`);
  return t;
}

// Texto opcional que se puede borrar enviando null o ""
export function textoNulo(b: Cuerpo, campo: string, max = 255): string | null | undefined {
  if (!(campo in b)) return undefined;
  if (b[campo] === null || b[campo] === '') return null;
  return texto(b, campo, { max });
}

export function entero(b: Cuerpo, campo: string, opc: { requerido?: boolean; min?: number; max?: number } = {}): number | undefined {
  const v = b[campo];
  if (vacio(v)) {
    if (opc.requerido) throw malo(`${campo} es obligatorio`);
    return undefined;
  }
  if (typeof v !== 'number' || !Number.isInteger(v)) throw malo(`${campo} debe ser un número entero`);
  if (opc.min !== undefined && v < opc.min) throw malo(`${campo} debe ser mayor o igual a ${opc.min}`);
  if (v > (opc.max ?? 1_000_000_000)) throw malo(`${campo} debe ser menor o igual a ${opc.max ?? 1_000_000_000}`);
  return v;
}

export function decimal(b: Cuerpo, campo: string, opc: { requerido?: boolean; min?: number } = {}): number | undefined {
  const v = b[campo];
  if (vacio(v)) {
    if (opc.requerido) throw malo(`${campo} es obligatorio`);
    return undefined;
  }
  if (typeof v !== 'number' || !Number.isFinite(v)) throw malo(`${campo} debe ser un número`);
  if (opc.min !== undefined && v < opc.min) throw malo(`${campo} debe ser mayor o igual a ${opc.min}`);
  if (v >= 1e10) throw malo(`${campo} es demasiado grande`);
  return Math.round(v * 100) / 100;
}

export function opcion<T extends string>(b: Cuerpo, campo: string, opciones: readonly T[], opc: { requerido?: boolean } = {}): T | undefined {
  const v = b[campo];
  if (vacio(v)) {
    if (opc.requerido) throw malo(`${campo} es obligatorio`);
    return undefined;
  }
  if (!opciones.includes(v as T)) throw malo(`${campo} debe ser uno de: ${opciones.join(', ')}`);
  return v as T;
}

export function booleano(b: Cuerpo, campo: string): boolean | undefined {
  const v = b[campo];
  if (v === undefined) return undefined;
  if (typeof v !== 'boolean') throw malo(`${campo} debe ser true o false`);
  return v;
}

export function correo(b: Cuerpo, campo: string, opc: { requerido?: boolean } = {}): string | undefined {
  const v = texto(b, campo, { ...opc, max: 150 });
  if (v === undefined) return undefined;
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)) throw malo(`${campo} no es un correo válido`);
  return v.toLowerCase();
}

export function contrasena(b: Cuerpo, campo: string, opc: { requerido?: boolean } = {}): string | undefined {
  const v = b[campo];
  if (vacio(v)) {
    if (opc.requerido) throw malo(`${campo} es obligatoria`);
    return undefined;
  }
  if (typeof v !== 'string') throw malo(`${campo} debe ser texto`);
  if (v.length < 8) throw malo(`${campo} debe tener al menos 8 caracteres`);
  if (v.length > 128) throw malo(`${campo} admite como máximo 128 caracteres`);
  return v;
}

// Contraseña tal como se escribió para compararla (login): sin recortar espacios,
// igual que se guardó, y sin exigir longitud mínima
export function claveEscrita(b: Cuerpo, campo: string): string {
  const v = b[campo];
  if (vacio(v)) throw malo(`${campo} es obligatoria`);
  if (typeof v !== 'string') throw malo(`${campo} debe ser texto`);
  if (v.length > 128) throw malo(`${campo} admite como máximo 128 caracteres`);
  return v;
}

// Clave única que genera el cliente para que un reenvío no se registre dos veces
export function claveCliente(b: Cuerpo): string | null {
  const v = b.clave_cliente;
  if (vacio(v)) return null;
  if (typeof v !== 'string' || !/^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(v)) throw malo('clave_cliente debe ser un UUID');
  return v.toLowerCase();
}

// Momento en que ocurrió una operación registrada sin conexión. Se admite hasta 30 días
// atrás (lo que dura la sesión) y 5 minutos adelante (relojes desajustados).
export function fechaOperacion(b: Cuerpo, campo: string): string | null {
  const v = b[campo];
  if (vacio(v)) return null;
  const ms = typeof v === 'string' ? Date.parse(v) : NaN;
  if (Number.isNaN(ms)) throw malo(`${campo} debe ser una fecha ISO 8601`);
  const diferencia = Date.now() - ms;
  if (diferencia < -5 * 60_000) throw malo(`${campo} no puede estar en el futuro`);
  if (diferencia > 30 * 24 * 3_600_000) throw malo(`${campo} no puede tener más de 30 días`);
  return new Date(ms).toISOString();
}

// Código de barras: letras, números y guiones, sin espacios; null lo borra (PATCH)
export function codigoBarras(b: Cuerpo): string | null | undefined {
  const v = textoNulo(b, 'codigo_barras', 64);
  if (typeof v === 'string' && !/^[0-9A-Za-z._-]{4,64}$/.test(v)) {
    throw malo('codigo_barras debe tener de 4 a 64 letras, números, puntos, guiones o guiones bajos');
  }
  return v;
}

// :id de la ruta. Un id que no es entero positivo no puede existir: 404
export function idRuta(req: Request, que: string): number {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id < 1 || id > 2_147_483_647) throw noEncontrado(que);
  return id;
}

// Parámetro entero opcional de la URL (?id_producto=5)
export function enteroQuery(req: Request, campo: string): number | undefined {
  const v = req.query[campo];
  if (v === undefined || v === '') return undefined;
  const n = Number(v);
  if (!Number.isInteger(n) || n < 1 || n > 2_147_483_647) throw malo(`${campo} debe ser un número entero positivo`);
  return n;
}

// Fecha opcional de la URL en formato ISO 8601 (2026-10-01 o 2026-10-01T08:00:00-06:00)
export function fechaQuery(req: Request, campo: string): string | undefined {
  const v = req.query[campo];
  if (v === undefined || v === '') return undefined;
  if (typeof v !== 'string' || !/^\d{4}-\d{2}-\d{2}/.test(v) || Number.isNaN(Date.parse(v))) {
    throw malo(`${campo} debe ser una fecha ISO 8601, por ejemplo 2026-10-01`);
  }
  return v;
}

// Texto de la URL restringido a una lista de valores
export function opcionQuery<T extends string>(req: Request, campo: string, opciones: readonly T[]): T | undefined {
  const v = String(req.query[campo] ?? '');
  if (!v) return undefined;
  if (!opciones.includes(v as T)) throw malo(`${campo} debe ser uno de: ${opciones.join(', ')}`);
  return v as T;
}
