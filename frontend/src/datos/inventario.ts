// Inventario disponible sin conexión y sincronización con la API.
//
//  - Toda escritura pasa por ejecutar(): con red se envía al momento; sin red (o si la red
//    falla a la mitad) entra a la cola de IndexedDB.
//  - Lo que se muestra sin conexión es la copia del servidor con la cola aplicada encima,
//    así un cambio pendiente se ve de inmediato y la copia nunca se altera a mano.
//  - sincronizar() envía la cola en orden. Cada operación lleva una clave única, por lo que
//    reenviarla no la duplica. Lo que la API rechaza (p. ej., stock insuficiente) queda
//    marcado con su motivo para que el usuario decida.

import { computed, ref, shallowRef } from 'vue';
import { ErrorApi, api, type Alerta, type FiltrosProductos, type Pagina, type Producto } from '@/api';
import { bd, type DatosMovimiento, type DatosProducto, type Operacion } from './bd';

/** Producto en pantalla: del servidor o un alta que aún no se envía (id_producto = 0) */
export interface ProductoLocal extends Producto {
  clave: string;
  /** Tiene cambios por enviar */
  pendiente: boolean;
}

export interface Resultado {
  /** false: quedó en la cola y se enviará cuando haya conexión */
  enviada: boolean;
  alerta: Alerta | null;
}

type Nueva = Omit<Operacion, 'id' | 'clave' | 'fecha' | 'estado'>;

const usuario = ref<number | null>(null);
// shallowRef: IndexedDB no puede guardar los proxies que crea ref()
const cola = shallowRef<Operacion[]>([]);
const sincronizando = ref(false);
// Aumenta cuando cambian los datos locales: las pantallas la observan para recargar
const version = ref(0);

const pendientes = computed(() => cola.value.filter((o) => o.estado === 'pendiente'));
const rechazadas = computed(() => cola.value.filter((o) => o.estado === 'rechazada'));

const sinRed = (error: unknown) => !(error instanceof ErrorApi) || [408, 429, 502, 503, 504].includes(error.status);
export const claveDe = (p: Operacion['producto']) => (p.id ? String(p.id) : `local-${p.local}`);

async function refrescarCola() {
  cola.value = usuario.value ? await bd.cola(usuario.value) : [];
  version.value++;
}

/** Se llama al cambiar de sesión. Solo aplica a usuarios con empresa (con inventario). */
export async function usarInventarioDe(idUsuario: number | null) {
  usuario.value = idUsuario;
  await refrescarCola().catch(() => (cola.value = []));
}

// --- Envío ----------------------------------------------------------------------

async function enviar(u: number, op: Operacion): Promise<Alerta | null> {
  const id = op.producto.id ?? 0;
  switch (op.tipo) {
    case 'crear_producto': {
      const creado = await api.crearProducto({ ...op.producto_datos!, clave_cliente: op.clave });
      if (op.id) await bd.altaEnviada(u, op, creado.id_producto);
      op.producto = { id: creado.id_producto, local: null };
      return creado.alerta_generada;
    }
    case 'editar_producto':
      return (await api.editarProducto(id, op.producto_datos!)).alerta_generada;
    case 'estado_producto':
      if (op.activo) await api.editarProducto(id, { estado: true });
      else await api.desactivarProducto(id);
      return null;
    case 'foto_producto':
      if (op.foto) await api.subirFoto(id, new Blob([op.foto.bytes], { type: op.foto.tipo }));
      else await api.quitarFoto(id);
      return null;
    case 'movimiento':
      return (await api.registrarMovimiento({ id_producto: id, ...op.movimiento!, clave_cliente: op.clave, fecha_movimiento: op.fecha })).alerta_generada;
  }
}

/**
 * Registra una operación. Devuelve si ya se envió; si la API la rechaza con la persona
 * presente, lanza el error para que el formulario lo muestre y no se encole.
 */
export async function ejecutar(nueva: Nueva): Promise<Resultado & { operacion: Operacion }> {
  const u = usuario.value;
  if (!u) throw new Error('No hay una empresa con sesión abierta');
  const op: Operacion = { ...nueva, clave: crypto.randomUUID(), fecha: new Date().toISOString(), estado: 'pendiente' };

  // Con operaciones anteriores por enviar se respeta el orden: primero ellas
  if (navigator.onLine && pendientes.value.length) await sincronizar();
  const dependeDeAlta = !op.producto.id && op.tipo !== 'crear_producto';
  if (navigator.onLine && !pendientes.value.length && !dependeDeAlta) {
    try {
      const alerta = await enviar(u, op);
      void descargar().catch(() => {});
      return { enviada: true, alerta, operacion: op };
    } catch (error) {
      if (!sinRed(error)) throw error;
    }
  }
  await bd.encolar(u, op);
  await refrescarCola();
  return { enviada: false, alerta: null, operacion: op };
}

const alertasNuevas: ((alerta: Alerta, nombre: string) => void)[] = [];
/** Avisa de cada alerta que se genere al sincronizar (para la notificación) */
export const alGenerarAlerta = (f: (alerta: Alerta, nombre: string) => void) => void alertasNuevas.push(f);

async function enviarCola(u: number) {
  for (;;) {
    const op = (await bd.cola(u)).find((o) => o.estado === 'pendiente');
    if (!op || usuario.value !== u) return;
    if (!op.producto.id && op.tipo !== 'crear_producto') {
      // Su alta fue rechazada o descartada: no hay a qué producto aplicarla
      await bd.actualizarOperacion(u, { ...op, estado: 'rechazada', error: 'El alta de este producto no se envió' });
      continue;
    }
    try {
      const alerta = await enviar(u, op);
      await bd.quitarOperaciones(u, [op.id!]);
      if (alerta) for (const f of alertasNuevas) f(alerta, op.nombreProducto);
    } catch (error) {
      // Sin red, sesión por renovar o falla del servidor: se conserva y se reintenta después
      if (sinRed(error) || (error as ErrorApi).status === 401 || (error as ErrorApi).status >= 500) return;
      await bd.actualizarOperacion(u, { ...op, estado: 'rechazada', error: (error as Error).message });
    }
  }
}

// Copia completa del catálogo (activos e inactivos), de 100 en 100
async function descargar() {
  const u = usuario.value;
  if (!u) return;
  const lista: Producto[] = [];
  for (let page = 1; ; page++) {
    const r = await api.productos({ q: '', estado: '', categoria: '', activo: 'todos', page, limit: 100 });
    lista.push(...r.data);
    if (page >= r.totalPages) break;
  }
  if (usuario.value !== u) return;
  await bd.reemplazarProductos(u, lista);
  version.value++;
}

let enCurso: Promise<void> | null = null;
/** Envía la cola y actualiza la copia local. Varias llamadas a la vez comparten una sola. */
export function sincronizar(): Promise<void> {
  const u = usuario.value;
  if (!u || !navigator.onLine) return Promise.resolve();
  enCurso ??= (async () => {
    sincronizando.value = true;
    try {
      // Con dos pestañas abiertas solo una envía la cola
      if (navigator.locks) await navigator.locks.request(`stockalert-sync-${u}`, () => enviarCola(u));
      else await enviarCola(u);
      await refrescarCola();
      await descargar();
    } catch {
      // Se reintenta al volver la conexión o al abrir la app
      await refrescarCola().catch(() => {});
    } finally {
      sincronizando.value = false;
      enCurso = null;
    }
  })();
  return enCurso;
}

/** Reintenta una operación rechazada (después de corregir la causa, p. ej. reponer stock) */
export async function reintentar(op: Operacion) {
  if (!usuario.value) return;
  await bd.actualizarOperacion(usuario.value, { ...op, estado: 'pendiente', error: undefined });
  await refrescarCola();
  await sincronizar();
}

/** Descarta una operación; si es un alta, también lo que dependía de ella */
export async function descartar(op: Operacion) {
  if (!usuario.value) return;
  const dependientes = op.tipo === 'crear_producto' ? cola.value.filter((o) => o.producto.local === op.clave && o.id !== op.id) : [];
  await bd.quitarOperaciones(usuario.value, [op, ...dependientes].map((o) => o.id!));
  await refrescarCola();
}

// --- Consulta local ----------------------------------------------------------------

const estadoStock = (actual: number, minimo: number) => (actual === 0 ? 'agotado' : actual < minimo ? 'bajo' : 'ok') as Producto['estado_stock'];

/** Catálogo del dispositivo con las operaciones pendientes aplicadas */
export async function productosLocales(): Promise<ProductoLocal[]> {
  const u = usuario.value;
  if (!u) return [];
  const mapa = new Map<string, ProductoLocal>();
  for (const p of await bd.productos(u)) mapa.set(String(p.id_producto), { ...p, clave: String(p.id_producto), pendiente: false });

  for (const op of await bd.cola(u)) {
    if (op.estado !== 'pendiente') continue;
    if (op.tipo === 'crear_producto') {
      const d = op.producto_datos!;
      const clave = `local-${op.clave}`;
      mapa.set(clave, {
        id_producto: 0,
        clave,
        nombre: d.nombre ?? '',
        descripcion: d.descripcion ?? null,
        categoria: d.categoria ?? null,
        codigo_barras: d.codigo_barras ?? null,
        stock_actual: d.stock_inicial ?? 0,
        stock_minimo: d.stock_minimo ?? 0,
        precio: d.precio ?? 0,
        fecha_actualizacion: op.fecha,
        estado: true,
        estado_stock: 'ok',
        foto_fecha: null,
        pendiente: true,
      });
      continue;
    }
    const p = mapa.get(claveDe(op.producto));
    if (!p) continue;
    p.pendiente = true;
    if (op.tipo === 'editar_producto') Object.assign(p, op.producto_datos);
    if (op.tipo === 'estado_producto') p.estado = !!op.activo;
    if (op.tipo === 'foto_producto') p.foto_fecha = op.foto ? op.fecha : null;
    if (op.tipo === 'movimiento') {
      const m = op.movimiento!;
      p.stock_actual = Math.max(0, p.stock_actual + (m.tipo_movimiento === 'salida' ? -m.cantidad : m.cantidad));
    }
  }
  for (const p of mapa.values()) p.estado_stock = estadoStock(p.stock_actual, p.stock_minimo);
  return [...mapa.values()];
}

const sinAcentos = (t: string) => t.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase();

/** Misma búsqueda, filtros, orden y paginación que GET /productos, sobre los datos del dispositivo */
export async function buscarLocal(f: FiltrosProductos): Promise<Pagina<ProductoLocal>> {
  const q = sinAcentos(f.q.trim());
  const lista = (await productosLocales())
    .filter((p) => f.activo === 'todos' || p.estado === (f.activo !== 'false'))
    .filter((p) => !q || sinAcentos(p.nombre).includes(q) || p.codigo_barras === f.q.trim())
    .filter((p) => !f.categoria || p.categoria === f.categoria)
    .filter((p) => !f.estado || (f.estado === 'reponer' ? p.estado_stock !== 'ok' : p.estado_stock === f.estado))
    .sort((a, b) => b.stock_minimo - b.stock_actual - (a.stock_minimo - a.stock_actual) || a.nombre.localeCompare(b.nombre));
  return {
    data: lista.slice((f.page - 1) * f.limit, f.page * f.limit),
    page: f.page,
    limit: f.limit,
    total: lista.length,
    totalPages: Math.max(1, Math.ceil(lista.length / f.limit)),
  };
}

/** Busca en la API y, si no hay red o quedan cambios por enviar, en el dispositivo */
export async function buscarProductos(f: FiltrosProductos, signal?: AbortSignal): Promise<{ pagina: Pagina<ProductoLocal>; local: boolean }> {
  if (navigator.onLine && !pendientes.value.length) {
    try {
      const r = await api.productos(f, signal);
      return { pagina: { ...r, data: r.data.map((p) => ({ ...p, clave: String(p.id_producto), pendiente: false })) }, local: false };
    } catch (error) {
      if ((error as Error).name === 'AbortError' || !sinRed(error)) throw error;
    }
  }
  return { pagina: await buscarLocal(f), local: true };
}

export async function categoriasLocales(): Promise<string[]> {
  return [...new Set((await productosLocales()).map((p) => p.categoria).filter((c): c is string => !!c))].sort((a, b) => a.localeCompare(b));
}

/** Producto activo con ese código de barras (para el escáner) */
export async function productoPorCodigo(codigo: string): Promise<ProductoLocal | null> {
  return (await productosLocales()).find((p) => p.estado && p.codigo_barras === codigo) ?? null;
}

/** Foto del producto como URL para <img>; se guarda la primera vez que se ve */
export async function urlDeFoto(p: ProductoLocal): Promise<string | null> {
  const u = usuario.value;
  if (!u || !p.foto_fecha) return null;
  // De IndexedDB y no de la copia en memoria: la lista pudo leerse antes de que esta se actualice
  const porSubir = (await bd.cola(u)).filter((o) => o.estado === 'pendiente' && o.tipo === 'foto_producto' && claveDe(o.producto) === p.clave).pop();
  if (porSubir?.foto) return URL.createObjectURL(new Blob([porSubir.foto.bytes], { type: porSubir.foto.tipo }));
  const guardada = await bd.foto(u, p.clave);
  if (guardada?.version === p.foto_fecha) return URL.createObjectURL(new Blob([guardada.bytes], { type: guardada.tipo }));
  try {
    const blob = await api.foto(p.id_producto);
    await bd.guardarFoto(u, { clave: p.clave, version: p.foto_fecha, tipo: blob.type, bytes: await blob.arrayBuffer() });
    return URL.createObjectURL(blob);
  } catch {
    return guardada ? URL.createObjectURL(new Blob([guardada.bytes], { type: guardada.tipo })) : null;
  }
}

export type { DatosMovimiento, DatosProducto, Operacion };
export const useInventario = () => ({ cola, pendientes, rechazadas, sincronizando, version });

// Momentos en que conviene intentar el envío. El reintento periódico cubre el caso en que el
// navegador cree tener red (wifi sin Internet) y por eso nunca emite el evento online.
window.addEventListener('online', () => void sincronizar());
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible' && pendientes.value.length) void sincronizar();
});
setInterval(() => {
  if (pendientes.value.length) void sincronizar();
}, 15_000);
