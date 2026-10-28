// Paso 2 del ETL: lee los CSV crudos, detecta campos vacíos, duplicados y tipos
// incorrectos, normaliza los campos que vienen en formatos mezclados y escribe
// CSV limpios listos para cargar. Al final imprime y guarda un reporte con
// cuántos registros se corrigieron y cuántos se descartaron (y por qué).

import fs from 'node:fs';
import path from 'node:path';
import { CLEAN_DIR, OUTPUT_DIR, RAW_DIR, TZ_OFFSET } from './config.js';
import { readCsv, writeCsv, type Row } from './csv.js';

// ---------- Reporte ----------

class Reporte {
  leidos = 0;
  sinCambios = 0;
  corregidos = 0;
  descartados = 0;
  correcciones: Record<string, number> = {};
  descartes: Record<string, number> = {};

  descartar(motivo: string): null {
    this.descartados++;
    this.descartes[motivo] = (this.descartes[motivo] ?? 0) + 1;
    return null;
  }

  aceptar(camposCorregidos: Set<string>): void {
    if (camposCorregidos.size === 0) {
      this.sinCambios++;
      return;
    }
    this.corregidos++;
    for (const campo of camposCorregidos) {
      this.correcciones[campo] = (this.correcciones[campo] ?? 0) + 1;
    }
  }

  get cargables(): number {
    return this.sinCambios + this.corregidos;
  }
}

// ---------- Normalizadores ----------

const slug = (text: string) =>
  text.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/\s+/g, ' ').trim();

const CATEGORIAS = [
  'Papelería', 'Abarrotes', 'Bebidas', 'Botanas', 'Limpieza', 'Higiene personal', 'Ferretería', 'Electrónica',
];
const CATEGORIA_POR_CLAVE = new Map(CATEGORIAS.map((c) => [slug(c), c]));

const TIPO_POR_CLAVE: Record<string, string> = {
  entrada: 'entrada', in: 'entrada', compra: 'entrada',
  salida: 'salida', out: 'salida', venta: 'salida',
  ajuste: 'ajuste',
};

function normalizarNombre(nombre: string): string {
  const limpio = nombre.replace(/\s+/g, ' ').trim();
  return limpio.charAt(0).toUpperCase() + limpio.slice(1);
}

function parseEntero(valor: string): number | null {
  return /^-?\d+$/.test(valor.trim()) ? Number(valor.trim()) : null;
}

// Acepta "12", "12.0", "12 pzas" y "-12"
function parseCantidad(valor: string): number | null {
  const m = valor.trim().match(/^(-?\d+)(?:\.0+)?(?:\s*pzas?)?$/i);
  return m ? Number(m[1]) : null;
}

function parsePrecio(valor: string): number | null {
  const limpio = valor.replace(/[$\s]/g, '');
  return /^\d+(\.\d{1,2})?$/.test(limpio) ? Number(limpio) : null;
}

const pad = (n: string | number) => String(n).padStart(2, '0');

// Convierte los formatos de fecha encontrados a ISO 8601 con la zona del negocio
function parseFecha(valor: string): string | null {
  const v = valor.trim();
  let y: string, mo: string, d: string, h: string, mi: string, s: string, tz: string;
  let m: RegExpMatchArray | null;
  if ((m = v.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})([+-]\d{2}:\d{2})$/))) {
    [, y, mo, d, h, mi, s, tz] = m;
  } else if ((m = v.match(/^(\d{4})-(\d{2})-(\d{2}) (\d{2}):(\d{2}):(\d{2})$/))) {
    [, y, mo, d, h, mi, s] = m;
    tz = TZ_OFFSET;
  } else if ((m = v.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4}) (\d{1,2}):(\d{2})$/))) {
    [, d, mo, y, h, mi] = m;
    s = '00';
    tz = TZ_OFFSET;
  } else {
    return null;
  }
  // Rechaza fechas imposibles como 31/02
  const check = new Date(Date.UTC(+y, +mo - 1, +d, +h, +mi, +s));
  if (check.getUTCMonth() !== +mo - 1 || check.getUTCDate() !== +d || +h > 23) return null;
  return `${y}-${pad(mo)}-${pad(d)}T${pad(h)}:${mi}:${s}${tz}`;
}

// ---------- Limpieza por tabla ----------

function limpiarUsuarios(rows: Row[], r: Reporte): Row[] {
  const vistos = new Set<string>();
  const limpios: Row[] = [];
  for (const row of rows) {
    r.leidos++;
    const corregidos = new Set<string>();
    const id = parseEntero(row.id_usuario);
    if (id === null) { r.descartar('id_usuario inválido'); continue; }
    if (vistos.has(String(id))) { r.descartar('duplicado'); continue; }

    const correo = row.correo.trim().toLowerCase();
    if (correo !== row.correo) corregidos.add('correo');
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(correo)) { r.descartar('correo inválido'); continue; }
    if (!['admin', 'almacen'].includes(row.rol)) { r.descartar('rol desconocido'); continue; }

    vistos.add(String(id));
    limpios.push({ ...row, id_usuario: String(id), correo });
    r.aceptar(corregidos);
  }
  return limpios;
}

function limpiarProductos(rows: Row[], r: Reporte): Row[] {
  const vistos = new Set<string>();
  const limpios: Row[] = [];
  for (const row of rows) {
    r.leidos++;
    const corregidos = new Set<string>();
    const id = parseEntero(row.id_producto);
    if (id === null) { r.descartar('id_producto inválido'); continue; }
    if (vistos.has(String(id))) { r.descartar('duplicado'); continue; }

    if (row.nombre.trim() === '') { r.descartar('campo vacío: nombre'); continue; }
    const nombre = normalizarNombre(row.nombre);
    if (nombre !== row.nombre) corregidos.add('nombre');

    const categoria = CATEGORIA_POR_CLAVE.get(slug(row.categoria));
    if (!categoria) { r.descartar('categoría desconocida'); continue; }
    if (categoria !== row.categoria) corregidos.add('categoria');

    const precio = parsePrecio(row.precio);
    if (precio === null) { r.descartar('tipo incorrecto: precio'); continue; }
    if (precio.toFixed(2) !== row.precio) corregidos.add('precio');

    const stockActual = parseEntero(row.stock_actual);
    const stockMinimo = parseEntero(row.stock_minimo);
    if (stockActual === null || stockMinimo === null || stockActual < 0 || stockMinimo < 0) {
      r.descartar('tipo incorrecto: stock'); continue;
    }

    const fecha = parseFecha(row.fecha_actualizacion);
    if (fecha === null) { r.descartar('fecha inválida'); continue; }

    vistos.add(String(id));
    limpios.push({
      id_producto: String(id),
      nombre,
      descripcion: row.descripcion.trim(),
      categoria,
      stock_actual: String(stockActual),
      stock_minimo: String(stockMinimo),
      precio: precio.toFixed(2),
      fecha_actualizacion: fecha,
      estado: row.estado,
    });
    r.aceptar(corregidos);
  }
  return limpios;
}

function limpiarMovimientos(rows: Row[], productos: Set<string>, usuarios: Set<string>, r: Reporte): Row[] {
  const folios = new Set<string>();
  const limpios: Row[] = [];
  for (const row of rows) {
    r.leidos++;
    const corregidos = new Set<string>();

    const folio = row.folio.trim().match(/^MOV-(\d+)$/);
    if (!folio) { r.descartar('folio inválido'); continue; }
    if (folios.has(folio[1])) { r.descartar('duplicado'); continue; }
    folios.add(folio[1]);

    // Campos obligatorios vacíos
    const vacio = (['id_producto', 'id_usuario', 'tipo_movimiento', 'cantidad', 'fecha_movimiento'] as const)
      .find((c) => row[c].trim() === '');
    if (vacio) { r.descartar(`campo vacío: ${vacio}`); continue; }

    const idProducto = parseEntero(row.id_producto);
    const idUsuario = parseEntero(row.id_usuario);
    if (idProducto === null || idUsuario === null) { r.descartar('tipo incorrecto: id'); continue; }
    if (!productos.has(String(idProducto))) { r.descartar('producto inexistente'); continue; }
    if (!usuarios.has(String(idUsuario))) { r.descartar('usuario inexistente'); continue; }

    const tipo = TIPO_POR_CLAVE[slug(row.tipo_movimiento)];
    if (!tipo) { r.descartar('tipo_movimiento desconocido'); continue; }
    if (tipo !== row.tipo_movimiento) corregidos.add('tipo_movimiento');

    let cantidad = parseCantidad(row.cantidad);
    if (cantidad === null) { r.descartar('tipo incorrecto: cantidad'); continue; }
    if (String(cantidad) !== row.cantidad) corregidos.add('cantidad');
    if (cantidad < 0 && tipo !== 'ajuste') {
      // Una salida capturada como "-5" se guarda como salida de 5
      cantidad = Math.abs(cantidad);
      corregidos.add('cantidad');
    }
    if (cantidad === 0) { r.descartar('cantidad en cero'); continue; }

    const fecha = parseFecha(row.fecha_movimiento);
    if (fecha === null) { r.descartar('fecha inválida'); continue; }
    if (fecha !== row.fecha_movimiento) corregidos.add('fecha_movimiento');

    const observaciones = row.observaciones.trim();
    if (observaciones !== row.observaciones) corregidos.add('observaciones');

    limpios.push({
      id_movimiento: folio[1].replace(/^0+/, ''),
      id_producto: String(idProducto),
      id_usuario: String(idUsuario),
      tipo_movimiento: tipo,
      cantidad: String(cantidad),
      fecha_movimiento: fecha,
      observaciones,
    });
    r.aceptar(corregidos);
  }
  // Orden cronológico (el archivo crudo viene desordenado)
  return limpios.sort((a, b) => Number(a.id_movimiento) - Number(b.id_movimiento));
}

function limpiarAlertas(rows: Row[], productos: Set<string>, r: Reporte): Row[] {
  const vistos = new Set<string>();
  const limpios: Row[] = [];
  for (const row of rows) {
    r.leidos++;
    if (vistos.has(row.id_alerta)) { r.descartar('duplicado'); continue; }
    if (!productos.has(row.id_producto)) { r.descartar('producto inexistente'); continue; }
    if (!['stock_bajo', 'agotado'].includes(row.tipo_alerta)) { r.descartar('tipo_alerta desconocido'); continue; }
    if (!['pendiente', 'atendida', 'cerrada'].includes(row.estado)) { r.descartar('estado desconocido'); continue; }
    if (parseFecha(row.fecha_generacion) === null) { r.descartar('fecha inválida'); continue; }
    vistos.add(row.id_alerta);
    limpios.push(row);
    r.aceptar(new Set());
  }
  return limpios;
}

// ---------- Main ----------

function main() {
  const leer = (nombre: string) => readCsv(path.join(RAW_DIR, nombre));
  if (!fs.existsSync(path.join(RAW_DIR, 'movimientos.csv'))) {
    throw new Error('No hay datos crudos. Ejecuta primero: npm run generate');
  }

  const reportes = {
    usuarios: new Reporte(),
    productos: new Reporte(),
    movimientos: new Reporte(),
    alertas: new Reporte(),
  };

  const usuarios = limpiarUsuarios(leer('usuarios.csv'), reportes.usuarios);
  const productos = limpiarProductos(leer('productos.csv'), reportes.productos);
  const idsProductos = new Set(productos.map((p) => p.id_producto));
  const idsUsuarios = new Set(usuarios.map((u) => u.id_usuario));
  const movimientos = limpiarMovimientos(leer('movimientos.csv'), idsProductos, idsUsuarios, reportes.movimientos);
  const alertas = limpiarAlertas(leer('alertas.csv'), idsProductos, reportes.alertas);

  fs.mkdirSync(CLEAN_DIR, { recursive: true });
  const salidas: [string, Row[]][] = [
    ['usuarios.csv', usuarios],
    ['productos.csv', productos],
    ['movimientos.csv', movimientos],
    ['alertas.csv', alertas],
  ];
  for (const [nombre, rows] of salidas) {
    writeCsv(path.join(CLEAN_DIR, nombre), Object.keys(rows[0]), rows);
  }

  console.log('Resumen de la transformación');
  console.table(
    Object.fromEntries(
      Object.entries(reportes).map(([tabla, r]) => [
        tabla,
        { leidos: r.leidos, sin_cambios: r.sinCambios, corregidos: r.corregidos, descartados: r.descartados, a_cargar: r.cargables },
      ]),
    ),
  );
  for (const [tabla, r] of Object.entries(reportes)) {
    if (Object.keys(r.correcciones).length) {
      console.log(`\n${tabla} - campos corregidos (filas):`);
      console.table(r.correcciones);
    }
    if (Object.keys(r.descartes).length) {
      console.log(`\n${tabla} - motivos de descarte (filas):`);
      console.table(r.descartes);
    }
  }

  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  const archivo = path.join(OUTPUT_DIR, 'reporte_transformacion.json');
  const json = Object.fromEntries(
    Object.entries(reportes).map(([tabla, r]) => [
      tabla,
      {
        leidos: r.leidos, sin_cambios: r.sinCambios, corregidos: r.corregidos, descartados: r.descartados,
        a_cargar: r.cargables, correcciones_por_campo: r.correcciones, descartes_por_motivo: r.descartes,
      },
    ]),
  );
  fs.writeFileSync(archivo, JSON.stringify(json, null, 2) + '\n', 'utf8');
  console.log(`\nDatos limpios en ${path.relative(process.cwd(), CLEAN_DIR)}; reporte en ${path.relative(process.cwd(), archivo)}`);
}

main();
