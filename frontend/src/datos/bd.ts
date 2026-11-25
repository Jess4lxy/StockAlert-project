// IndexedDB: inventario guardado en el dispositivo y cola de operaciones por enviar.
// Cada usuario tiene su propia base (stockalert-u<id>), así otra cuenta en el mismo
// dispositivo no ve sus datos. Al cerrar sesión se borran el inventario y las fotos; la
// cola se conserva para que no se pierda lo que aún no llega al servidor.
//
// Almacenes:
//   productos  copia del catálogo tal como lo tiene el servidor (clave: id_producto)
//   cola       operaciones registradas sin conexión, en orden (clave: id autoincremental)
//   fotos      fotos ya vistas o por subir (clave: id del producto o clave local)
//   meta       datos sueltos (última sincronización, última alerta avisada)

import type { Producto } from '@/api';

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
let abierta: { usuario: number; bd: Promise<IDBDatabase> } | null = null;

function abrir(usuario: number): Promise<IDBDatabase> {
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

async function leer<T>(usuario: number, almacen: string, accion: (a: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  const bd = await abrir(usuario);
  return comoPromesa(accion(bd.transaction(almacen).objectStore(almacen)));
}

async function escribir(usuario: number, almacenes: string[], accion: (tx: IDBTransaction) => void): Promise<void> {
  const bd = await abrir(usuario);
  const tx = bd.transaction(almacenes, 'readwrite');
  const fin = terminada(tx);
  accion(tx);
  await fin;
}

/** Operaciones sobre la base del usuario indicado */
export const bd = {
  productos: (u: number) => leer<Producto[]>(u, 'productos', (a) => a.getAll()),

  // Reemplaza la copia completa en una sola transacción: nunca queda a medias
  reemplazarProductos: (u: number, lista: Producto[]) =>
    escribir(u, ['productos', 'meta'], (tx) => {
      const almacen = tx.objectStore('productos');
      almacen.clear();
      for (const p of lista) almacen.put(p);
      tx.objectStore('meta').put({ clave: 'sincronizado', valor: new Date().toISOString() });
    }),

  guardarProducto: (u: number, producto: Producto) => escribir(u, ['productos'], (tx) => void tx.objectStore('productos').put(producto)),

  cola: (u: number) => leer<Operacion[]>(u, 'cola', (a) => a.getAll()),
  encolar: (u: number, op: Operacion) => escribir(u, ['cola'], (tx) => void tx.objectStore('cola').add(op)),
  actualizarOperacion: (u: number, op: Operacion) => escribir(u, ['cola'], (tx) => void tx.objectStore('cola').put(op)),
  quitarOperaciones: (u: number, ids: number[]) =>
    escribir(u, ['cola'], (tx) => {
      for (const id of ids) tx.objectStore('cola').delete(id);
    }),

  // Un alta llegó al servidor: las operaciones que dependían de ella ya conocen su id.
  // Todo en una transacción para que un cierre inesperado no las deje huérfanas.
  async altaEnviada(u: number, op: Operacion, idProducto: number) {
    const pendientes = await this.cola(u);
    await escribir(u, ['cola'], (tx) => {
      const almacen = tx.objectStore('cola');
      almacen.delete(op.id!);
      for (const p of pendientes) {
        if (p.id !== op.id && p.producto.local === op.clave) almacen.put({ ...p, producto: { id: idProducto, local: null } });
      }
    });
  },

  foto: (u: number, clave: string) => leer<FotoGuardada | undefined>(u, 'fotos', (a) => a.get(clave)),
  guardarFoto: (u: number, foto: FotoGuardada) => escribir(u, ['fotos'], (tx) => void tx.objectStore('fotos').put(foto)),

  async meta(u: number, clave: string): Promise<string | null> {
    return (await leer<{ valor: string } | undefined>(u, 'meta', (a) => a.get(clave)))?.valor ?? null;
  },
  guardarMeta: (u: number, clave: string, valor: string) => escribir(u, ['meta'], (tx) => void tx.objectStore('meta').put({ clave, valor })),

  // Cierre de sesión: solo queda la cola
  olvidarDatos: (u: number) =>
    escribir(u, ['productos', 'fotos', 'meta'], (tx) => {
      for (const almacen of ['productos', 'fotos', 'meta']) tx.objectStore(almacen).clear();
    }),
};
