const API_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:3000/api';

export type TipoMovimiento = 'entrada' | 'salida' | 'ajuste';
export type TipoAlerta = 'stock_bajo' | 'agotado';
export type EstadoAlerta = 'pendiente' | 'atendida' | 'cerrada';
export type EstadoStock = 'agotado' | 'bajo' | 'ok';
export type Rol = 'plataforma' | 'admin' | 'almacen';

export interface Movimiento {
  id_movimiento: number;
  fecha_movimiento: string;
  tipo_movimiento: TipoMovimiento;
  cantidad: number;
  observaciones: string | null;
  id_producto: number;
  producto: string;
  categoria: string;
  id_usuario: number;
  usuario: string;
}

export interface Producto {
  id_producto: number;
  nombre: string;
  descripcion: string | null;
  categoria: string;
  stock_actual: number;
  stock_minimo: number;
  precio: number;
  fecha_actualizacion: string;
  estado: boolean;
  estado_stock: EstadoStock;
}

export interface Alerta {
  id_alerta: number;
  id_producto: number;
  producto: string;
  categoria: string;
  tipo_alerta: TipoAlerta;
  stock_detectado: number;
  fecha_generacion: string;
  estado: EstadoAlerta;
  fecha_atencion: string | null;
}

export interface Pagina<T> {
  data: T[];
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export interface FiltrosMovimientos {
  q: string;
  tipo: string;
  categoria: string;
  page: number;
  limit: number;
}

export interface FiltrosProductos {
  q: string;
  estado: string;
  categoria: string;
  page: number;
  limit: number;
}

export interface FiltrosAlertas {
  estado: string;
  tipo: string;
  page: number;
  limit: number;
}

export interface UsuarioSesion {
  id_usuario: number;
  nombre: string;
  correo: string;
  rol: Rol;
  empresa: { id_empresa: number; nombre: string } | null;
}

export interface Sesion {
  token: string;
  usuario: UsuarioSesion;
}

export interface Empresa {
  id_empresa: number;
  nombre: string;
  fecha_registro: string;
  estado: boolean;
  usuarios: number;
  productos: number;
}

export interface Usuario {
  id_usuario: number;
  nombre: string;
  correo: string;
  rol: Rol;
  estado: boolean;
  fecha_registro: string;
  id_empresa: number | null;
  empresa: string | null;
}

export interface FiltrosEmpresas {
  q: string;
  estado: string;
  page: number;
  limit: number;
}

export interface FiltrosUsuarios {
  q: string;
  rol: string;
  estado: string;
  id_empresa: number | '';
  page: number;
  limit: number;
}

type Parametros = Record<string, string | number>;

// Error con el mensaje que envía la API ({ error }) y su código HTTP
export class ErrorApi extends Error {
  constructor(
    public status: number,
    mensaje: string,
  ) {
    super(mensaje);
  }
}

// Sesión: sesion.ts guarda aquí el token y qué hacer si la API lo rechaza (401)
let token: string | null = null;
let alRechazarSesion: (() => void) | null = null;
export function configurarSesion(nuevo: string | null, alRechazar?: () => void) {
  token = nuevo;
  if (alRechazar) alRechazarSesion = alRechazar;
}

function construirUrl(ruta: string, params: Parametros = {}): string {
  // El segundo argumento permite una VITE_API_URL relativa (/api), como la del despliegue
  const url = new URL(`${API_URL}${ruta}`, window.location.origin);
  for (const [clave, valor] of Object.entries(params)) {
    if (valor !== '') url.searchParams.set(clave, String(valor));
  }
  return url.href;
}

async function pedir<T>(metodo: string, ruta: string, opciones: { params?: Parametros; body?: unknown; signal?: AbortSignal } = {}): Promise<T> {
  const res = await fetch(construirUrl(ruta, opciones.params), {
    method: metodo,
    signal: opciones.signal,
    headers: {
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(opciones.body !== undefined ? { 'Content-Type': 'application/json' } : {}),
    },
    body: opciones.body !== undefined ? JSON.stringify(opciones.body) : undefined,
  });
  if (!res.ok) {
    const datos = await res.json().catch(() => null);
    // Un 401 con sesión abierta significa que expiró o la desactivaron
    if (res.status === 401 && token && !ruta.startsWith('/auth/')) alRechazarSesion?.();
    throw new ErrorApi(res.status, datos?.error ?? `Error ${res.status} al consultar ${ruta}`);
  }
  return (res.status === 204 ? undefined : await res.json()) as T;
}

const get = <T>(ruta: string, params: Parametros = {}, signal?: AbortSignal) => pedir<T>('GET', ruta, { params, signal });

export interface ProductoPorReponer {
  id_producto: number;
  nombre: string;
  categoria: string;
  stock_actual: number;
  stock_minimo: number;
  faltante: number;
}

export interface Dashboard {
  meses: number;
  // null en una empresa que todavía no registra movimientos
  periodo: { inicio: string | null; fin: string | null };
  stockBajo: { productos: number; total: number };
  unidadesVendidas: { actual: number; anterior: number | null; variacion: number | null };
  categoriaTop: { categoria: string; unidades: number; participacion: number } | null;
  porMes: { mes: string; entradas: number; salidas: number }[];
  porCategoria: { categoria: string; unidades: number }[];
  porReponer: ProductoPorReponer[];
}

export const api = {
  // Sesión
  login: (correo: string, contrasena: string) => pedir<Sesion>('POST', '/auth/login', { body: { correo, contrasena } }),
  registro: (datos: { empresa: string; nombre: string; correo: string; contrasena: string }) =>
    pedir<Sesion>('POST', '/auth/registro', { body: datos }),
  yo: () => get<UsuarioSesion>('/auth/yo'),

  // Inventario de la empresa
  movimientos: (filtros: FiltrosMovimientos, signal?: AbortSignal) =>
    get<Pagina<Movimiento>>('/movimientos', { ...filtros }, signal),
  categorias: () => get<string[]>('/categorias'),
  dashboard: (meses: number, signal?: AbortSignal) => get<Dashboard>('/dashboard', { meses }, signal),
  productos: (filtros: FiltrosProductos, signal?: AbortSignal) =>
    get<Pagina<Producto>>('/productos', { ...filtros }, signal),
  alertas: (filtros: FiltrosAlertas, signal?: AbortSignal) => get<Pagina<Alerta>>('/alertas', { ...filtros }, signal),
  resumenAlertas: () => get<{ pendientes: number; total: number }>('/alertas/resumen'),

  // Administración
  empresas: (filtros: FiltrosEmpresas, signal?: AbortSignal) => get<Pagina<Empresa>>('/empresas', { ...filtros }, signal),
  crearEmpresa: (datos: { nombre: string; admin?: { nombre: string; correo: string; contrasena: string } }) =>
    pedir<Empresa>('POST', '/empresas', { body: datos }),
  editarEmpresa: (id: number, datos: { nombre?: string; estado?: boolean }) => pedir<Empresa>('PATCH', `/empresas/${id}`, { body: datos }),
  usuarios: (filtros: FiltrosUsuarios, signal?: AbortSignal) => get<Pagina<Usuario>>('/usuarios', { ...filtros }, signal),
  crearUsuario: (datos: { nombre: string; correo: string; contrasena: string; rol: Rol; id_empresa?: number }) =>
    pedir<Usuario>('POST', '/usuarios', { body: datos }),
  editarUsuario: (id: number, datos: { nombre?: string; correo?: string; rol?: Rol; estado?: boolean; contrasena?: string }) =>
    pedir<Usuario>('PATCH', `/usuarios/${id}`, { body: datos }),
};

// Lo que cada pantalla pide al abrirse, sin filtros. El Service Worker lo guarda al
// iniciar sesión para que las cuatro secciones abran sin conexión aunque no se hayan visitado.
// Los parámetros van en el mismo orden que los filtros de cada vista: la caché compara la URL exacta.
export const urlsEsenciales = (): string[] => [
  construirUrl('/dashboard', { meses: 3 }),
  construirUrl('/dashboard', { meses: 6 }),
  construirUrl('/dashboard', { meses: 12 }),
  construirUrl('/productos', { page: 1, limit: 20 }),
  construirUrl('/movimientos', { page: 1, limit: 20 }),
  construirUrl('/alertas', { page: 1, limit: 20 }),
  construirUrl('/alertas/resumen'),
  construirUrl('/categorias'),
];

// Mensaje para el usuario: el de la API si rechazó la petición (400, 403, 409…);
// si no hubo respuesta, explica si falta conexión o si la API no responde.
export function mensajeDeError(error?: unknown): string {
  if (error instanceof ErrorApi && error.status < 500) return error.message;
  return navigator.onLine
    ? 'No se pudo conectar con la API. Intenta de nuevo en un momento.'
    : 'Sin conexión: esta consulta todavía no está guardada en el dispositivo. Vuelve a intentarlo cuando tengas Internet.';
}
