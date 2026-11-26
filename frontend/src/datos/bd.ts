// IndexedDB: inventario guardado en el dispositivo y cola de operaciones por enviar.
// Cada usuario tiene su propia base por empresa, así otra cuenta en el mismo dispositivo no
// ve sus datos y lo pendiente de una empresa nunca se envía a otra. Al cerrar sesión o cambiar
// de empresa se borran el inventario y las fotos; la cola se conserva para que no se pierda lo
// que aún no llega al servidor.
//
// Almacenes:
//   productos  copia del catálogo tal como lo tiene el servidor (clave: id_producto)
//   cola       operaciones registradas sin conexión, en orden (clave: id autoincremental)
//   fotos      fotos ya vistas o por subir (clave: id del producto o clave local)
//   meta       datos sueltos (última sincronización, última alerta avisada)

import type { Producto, UsuarioSesion } from '@/api';

/**
 * Base del usuario en la empresa que tiene abierta (null: sin inventario). La de su primera
 * empresa conserva el nombre de cuando solo se podía tener una, con lo que tuviera pendiente.
 */
export function claveInventario(u: UsuarioSesion | null | undefined): string | null {
  if (!u?.empresa) return null;
  const id = u.empresa.id_empresa;
  const principal = u.empresas?.find((e) => e.id_empresa === id)?.principal ?? true;
  return principal ? String(u.id_usuario) : `${u.id_usuario}-e${id}`;
}

export type TipoOperacion = 'crear_producto' | 'editar_producto' | 'estado_producto' | 'movimiento' | 'foto_producto';

export interface DatosProducto {
  nombre?: string;
  descripcion?: string | null;
  categoria?: string | null;
  codigo_barras?: string | null;
  precio?: number;
  stock_minimo?: number;
  stock_inicial?: number;
}

export interface DatosMovimiento {
  tipo_movimiento: 'entrada' | 'salida' | 'ajuste';
  cantidad: number;
  observaciones?: string;
}

export interface Operacion {
  id?: number;
  tipo: TipoOperacion;
  /** UUID de la operación: la API lo usa para no aplicar dos veces un reenvío */
  clave: string;
  /** Producto al que se aplica: su id, o la clave del alta si todavía no existe en el servidor */
  producto: { id: number | null; local: string | null };
  nombreProducto: string;
  producto_datos?: DatosProducto;
  movimiento?: DatosMovimiento;
  activo?: boolean;
  /** null quita la foto */
  foto?: { tipo: string; bytes: ArrayBuffer } | null;
  /** Cuándo la registró el usuario */
  fecha: string;
  estado: 'pendiente' | 'rechazada';
  error?: string;
}

interface FotoGuardada {
  clave: string;
  version: string;
  tipo: string;
  bytes: ArrayBuffer;
}

const VERSION = 1;
let abierta: { usuario: string; bd: Promise<IDBDatabase> } | null = null;

function abrir(usuario: string): Promise<IDBDatabase> {
  if (abierta?.usuario === usuario) return abierta.bd;
  const bd = new Promise<IDBDatabase>((resolver, rechazar) => {
    const peticion = indexedDB.open(`stockalert-u${usuario}`, VERSION);
    peticion.onupgradeneeded = () => {
      const base = peticion.result;
      base.createObjectStore('productos', { keyPath: 'id_producto' });
      base.createObjectStore('cola', { keyPath: 'id', autoIncrement: true });
      base.createObjectStore('fotos', { keyPath: 'clave' });
      base.createObjectStore('meta', { keyPath: 'clave' });
    };
    peticion.onsuccess = () => {
      // Otra pestaña con una versión nueva de la app pide actualizar la base
      peticion.result.onversionchange = () => {
        peticion.result.close();
        abierta = null;
      };
      resolver(peticion.result);
    };
    peticion.onerror = () => rechazar(peticion.error);
  });
  abierta = { usuario, bd };
  bd.catch(() => (abierta = null));
  return bd;
}

const comoPromesa = <T>(p: IDBRequest<T>) =>
  new Promise<T>((resolver, rechazar) => {
    p.onsuccess = () => resolver(p.result);
    p.onerror = () => rechazar(p.error);
  });

const terminada = (tx: IDBTransaction) =>
  new Promise<void>((resolver, rechazar) => {
    tx.oncomplete = () => resolver();
    tx.onerror = () => rechazar(tx.error);
    tx.onabort = () => rechazar(tx.error);
  });

async function leer<T>(usuario: string, almacen: string, accion: (a: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  const bd = await abrir(usuario);
  return comoPromesa(accion(bd.transaction(almacen).objectStore(almacen)));
}

async function escribir(usuario: string, almacenes: string[], accion: (tx: IDBTransaction) => void): Promise<void> {
  const bd = await abrir(usuario);
  const tx = bd.transaction(almacenes, 'readwrite');
  const fin = terminada(tx);
  accion(tx);
  await fin;
}

/** Operaciones sobre la base del usuario indicado */
export const bd = {
  productos: (u: string) => leer<Producto[]>(u, 'productos', (a) => a.getAll()),

  // Reemplaza la copia completa en una sola transacción: nunca queda a medias
  reemplazarProductos: (u: string, lista: Producto[]) =>
    escribir(u, ['productos', 'meta'], (tx) => {
      const almacen = tx.objectStore('productos');
      almacen.clear();
      for (const p of lista) almacen.put(p);
      tx.objectStore('meta').put({ clave: 'sincronizado', valor: new Date().toISOString() });
    }),

  guardarProducto: (u: string, producto: Producto) => escribir(u, ['productos'], (tx) => void tx.objectStore('productos').put(producto)),

  cola: (u: string) => leer<Operacion[]>(u, 'cola', (a) => a.getAll()),
  encolar: (u: string, op: Operacion) => escribir(u, ['cola'], (tx) => void tx.objectStore('cola').add(op)),
  actualizarOperacion: (u: string, op: Operacion) => escribir(u, ['cola'], (tx) => void tx.objectStore('cola').put(op)),
  quitarOperaciones: (u: string, ids: number[]) =>
    escribir(u, ['cola'], (tx) => {
      for (const id of ids) tx.objectStore('cola').delete(id);
    }),

  // Un alta llegó al servidor: las operaciones que dependían de ella ya conocen su id.
  // Todo en una transacción para que un cierre inesperado no las deje huérfanas.
  async altaEnviada(u: string, op: Operacion, idProducto: number) {
    const pendientes = await this.cola(u);
    await escribir(u, ['cola'], (tx) => {
      const almacen = tx.objectStore('cola');
      almacen.delete(op.id!);
      for (const p of pendientes) {
        if (p.id !== op.id && p.producto.local === op.clave) almacen.put({ ...p, producto: { id: idProducto, local: null } });
      }
    });
  },

  foto: (u: string, clave: string) => leer<FotoGuardada | undefined>(u, 'fotos', (a) => a.get(clave)),
  guardarFoto: (u: string, foto: FotoGuardada) => escribir(u, ['fotos'], (tx) => void tx.objectStore('fotos').put(foto)),

  async meta(u: string, clave: string): Promise<string | null> {
    return (await leer<{ valor: string } | undefined>(u, 'meta', (a) => a.get(clave)))?.valor ?? null;
  },
  guardarMeta: (u: string, clave: string, valor: string) => escribir(u, ['meta'], (tx) => void tx.objectStore('meta').put({ clave, valor })),

  // Cierre de sesión o cambio de empresa: solo queda la cola
  olvidarDatos: (u: string) =>
    escribir(u, ['productos', 'fotos', 'meta'], (tx) => {
      for (const almacen of ['productos', 'fotos', 'meta']) tx.objectStore(almacen).clear();
    }),
};
