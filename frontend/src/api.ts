const API_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:3000/api';

export type TipoMovimiento = 'entrada' | 'salida' | 'ajuste';

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

async function get<T>(ruta: string, params: Record<string, string | number> = {}, signal?: AbortSignal): Promise<T> {
  const url = new URL(`${API_URL}${ruta}`);
  for (const [clave, valor] of Object.entries(params)) {
    if (valor !== '') url.searchParams.set(clave, String(valor));
  }
  const res = await fetch(url, { signal });
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
};
