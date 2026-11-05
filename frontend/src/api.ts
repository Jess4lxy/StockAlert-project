const API_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:3000/api';

export type TipoMovimiento = 'entrada' | 'salida' | 'ajuste';
export type TipoAlerta = 'stock_bajo' | 'agotado';
export type EstadoAlerta = 'pendiente' | 'atendida' | 'cerrada';
export type EstadoStock = 'agotado' | 'bajo' | 'ok';

export interface Movimiento {
  id_movimiento: number;
  fecha_movimiento: string;
  tipo_movimiento: TipoMovimiento;
  cantidad: number;
  observaciones: string | null;
  id_producto: number;
  producto: string;
  categoria: string;
  usuario: string;
}

export interface Producto {
  id_producto: number;
  nombre: string;
  categoria: string;
  stock_actual: number;
  stock_minimo: number;
  precio: number;
  fecha_actualizacion: string;
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

type Parametros = Record<string, string | number>;

function construirUrl(ruta: string, params: Parametros = {}): string {
  const url = new URL(`${API_URL}${ruta}`);
  for (const [clave, valor] of Object.entries(params)) {
    if (valor !== '') url.searchParams.set(clave, String(valor));
  }
  return url.href;
}

async function get<T>(ruta: string, params: Parametros = {}, signal?: AbortSignal): Promise<T> {
  const res = await fetch(construirUrl(ruta, params), { signal });
  if (!res.ok) throw new Error(`Error ${res.status} al consultar ${ruta}`);
  return res.json() as Promise<T>;
}

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
  periodo: { inicio: string; fin: string };
  stockBajo: { productos: number; total: number };
  unidadesVendidas: { actual: number; anterior: number | null; variacion: number | null };
  categoriaTop: { categoria: string; unidades: number; participacion: number } | null;
  porMes: { mes: string; entradas: number; salidas: number }[];
  porCategoria: { categoria: string; unidades: number }[];
  porReponer: ProductoPorReponer[];
}

export const api = {
  movimientos: (filtros: FiltrosMovimientos, signal?: AbortSignal) =>
    get<Pagina<Movimiento>>('/movimientos', { ...filtros }, signal),
  categorias: () => get<string[]>('/categorias'),
  dashboard: (meses: number, signal?: AbortSignal) => get<Dashboard>('/dashboard', { meses }, signal),
  productos: (filtros: FiltrosProductos, signal?: AbortSignal) =>
    get<Pagina<Producto>>('/productos', { ...filtros }, signal),
  alertas: (filtros: FiltrosAlertas, signal?: AbortSignal) => get<Pagina<Alerta>>('/alertas', { ...filtros }, signal),
  resumenAlertas: () => get<{ pendientes: number; total: number }>('/alertas/resumen'),
};

// Lo que cada pantalla pide al abrirse, sin filtros. El Service Worker lo guarda al
// arrancar para que las cuatro secciones abran sin conexión aunque no se hayan visitado.
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

export const mensajeDeError = (): string =>
  navigator.onLine
    ? 'No se pudo conectar con la API. ¿Está corriendo el backend?'
    : 'Sin conexión: esta consulta todavía no está guardada en el dispositivo. Vuelve a intentarlo cuando tengas Internet.';
