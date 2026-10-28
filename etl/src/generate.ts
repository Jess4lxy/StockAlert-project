// Paso 1 del ETL: genera datos sintéticos (ficticios) de un negocio pequeño y los
// guarda como CSV "sucios", tal como llegarían de una exportación manual o de Excel.
//
// - 8 usuarios, 93 productos y 10,000 movimientos válidos en 12 meses.
// - Las alertas salen de simular el stock movimiento por movimiento.
// - Se introducen errores a propósito (formatos mezclados, duplicados, vacíos,
//   tipos incorrectos) para que la transformación tenga algo que limpiar.

import fs from 'node:fs';
import path from 'node:path';
import { RAW_DIR, SAMPLE_DIR, SEED, TOTAL_MOVIMIENTOS, TZ_OFFSET } from './config.js';
import { writeCsv, type Row } from './csv.js';
import { Random } from './random.js';

const rnd = new Random(SEED);

// ---------- Catálogo ----------

const CATALOGO: Record<string, { precio: [number, number]; productos: string[] }> = {
  'Papelería': {
    precio: [5, 180],
    productos: [
      'Cuaderno profesional 100 hojas', 'Cuaderno francés 100 hojas', 'Lápiz HB', 'Pluma azul',
      'Pluma negra', 'Marcador permanente negro', 'Marcador para pizarrón', 'Resistol en barra 20 g',
      'Folder tamaño carta', 'Hojas blancas paquete 500', 'Cinta adhesiva transparente',
      'Tijeras escolares', 'Borrador blanco', 'Sacapuntas metálico', 'Regla 30 cm',
      'Corrector líquido', 'Calculadora básica', 'Clips caja 100', 'Grapas caja 1000',
      'Engrapadora estándar', 'Papel bond carta', 'Cartulina blanca', 'Plumones de colores 12 pzas',
      'Colores 24 pzas', 'Sobre manila carta',
    ],
  },
  'Abarrotes': {
    precio: [15, 95],
    productos: [
      'Arroz 1 kg', 'Frijol negro 1 kg', 'Azúcar 1 kg', 'Aceite vegetal 1 L', 'Sal de mesa 1 kg',
      'Harina de trigo 1 kg', 'Pasta para sopa 200 g', 'Atún en lata 140 g', 'Café soluble 120 g',
      'Leche entera 1 L', 'Huevo blanco 12 pzas', 'Mayonesa 390 g', 'Galletas marías 170 g',
      'Avena 400 g', 'Chiles en lata 220 g',
    ],
  },
  'Bebidas': {
    precio: [10, 45],
    productos: [
      'Agua natural 1 L', 'Agua natural 600 ml', 'Refresco de cola 600 ml', 'Refresco de cola 2 L',
      'Jugo de naranja 1 L', 'Bebida isotónica 600 ml', 'Té helado 500 ml', 'Agua mineral 355 ml',
    ],
  },
  'Botanas': {
    precio: [8, 40],
    productos: [
      'Papas fritas 45 g', 'Cacahuates japoneses 100 g', 'Chicharrón de harina 80 g',
      'Palomitas 90 g', 'Galletas saladas 137 g', 'Barra de granola 35 g',
      'Chocolate de leche 40 g', 'Dulce de tamarindo 10 pzas',
    ],
  },
  'Limpieza': {
    precio: [12, 120],
    productos: [
      'Detergente en polvo 1 kg', 'Cloro 1 L', 'Jabón para trastes 750 ml',
      'Limpiador multiusos 1 L', 'Escoba de plástico', 'Trapeador de algodón',
      'Bolsas para basura 10 pzas', 'Fibra verde 3 pzas', 'Suavizante de telas 850 ml',
      'Guantes de látex',
    ],
  },
  'Higiene personal': {
    precio: [15, 110],
    productos: [
      'Papel higiénico 4 rollos', 'Jabón de tocador 150 g', 'Shampoo 750 ml', 'Pasta dental 100 ml',
      'Cepillo dental', 'Desodorante en barra', 'Toallas húmedas 80 pzas', 'Gel antibacterial 500 ml',
    ],
  },
  'Ferretería': {
    precio: [10, 250],
    productos: [
      'Tornillo para madera 1" 100 pzas', 'Clavo 2" 1 kg', 'Cinta de aislar', 'Foco LED 9 W',
      'Extensión eléctrica 3 m', 'Pegamento instantáneo', 'Lija de agua 100', 'Brocha 2"',
      'Martillo de uña', 'Desarmador plano', 'Candado 40 mm', 'Silicón transparente',
    ],
  },
  'Electrónica': {
    precio: [30, 350],
    productos: [
      'Pilas AA 4 pzas', 'Pilas AAA 4 pzas', 'Cable USB-C 1 m', 'Cargador de pared USB',
      'Audífonos alámbricos', 'Memoria USB 32 GB', 'Mouse inalámbrico',
    ],
  },
};

const USUARIOS = [
  { nombre: 'Mariana Canché Poot', rol: 'admin' },
  { nombre: 'Roberto Chan Uc', rol: 'admin' },
  { nombre: 'Daniela Pech Ek', rol: 'almacen' },
  { nombre: 'Luis Tun Cauich', rol: 'almacen' },
  { nombre: 'Fernanda Dzul May', rol: 'almacen' },
  { nombre: 'Jorge Couoh Bacab', rol: 'almacen' },
  { nombre: 'Karla Euan Noh', rol: 'almacen' },
  { nombre: 'Miguel Balam Can', rol: 'almacen' },
] as const;

// ---------- Fechas (hora local del negocio) ----------

const DAY = 24 * 60 * 60 * 1000;
// Las fechas se manejan como "hora local guardada en UTC" y se imprimen con TZ_OFFSET
const INICIO = Date.UTC(2025, 9, 28); // 28-oct-2025
const DIAS = 365;

const pad = (n: number) => String(n).padStart(2, '0');

function parts(t: number) {
  const d = new Date(t);
  return {
    y: d.getUTCFullYear(), m: pad(d.getUTCMonth() + 1), d: pad(d.getUTCDate()),
    H: pad(d.getUTCHours()), M: pad(d.getUTCMinutes()), S: pad(d.getUTCSeconds()),
  };
}

function isoLocal(t: number): string {
  const p = parts(t);
  return `${p.y}-${p.m}-${p.d}T${p.H}:${p.M}:${p.S}${TZ_OFFSET}`;
}

function randomBusinessTime(): number {
  const day = rnd.int(0, DIAS - 1);
  const minutes = rnd.int(8 * 60, 20 * 60 + 59); // de 08:00 a 20:59
  return INICIO + day * DAY + minutes * 60_000;
}

// ---------- Generación ----------

function slug(text: string): string {
  return text.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
}

function generarUsuarios(): Row[] {
  return USUARIOS.map((u, i) => {
    const [nombre, apellido] = slug(u.nombre).split(' ');
    return {
      id_usuario: String(i + 1),
      nombre: u.nombre,
      correo: `${nombre}.${apellido}@stockalert.test`,
      // Usuarios ficticios sin contraseña real: el valor no corresponde a ningún hash válido
      contrasena_hash: 'sin-acceso',
      rol: u.rol,
      fecha_registro: isoLocal(Date.UTC(2025, 9, 1 + i, 9)),
      estado: 'true',
    };
  });
}

interface Producto {
  id: number;
  nombre: string;
  categoria: string;
  precio: number;
  stock: number;
  minimo: number;
  peso: number; // qué tan seguido se mueve
  ultimaFecha: number;
}

function generarProductos(): Producto[] {
  const productos: Producto[] = [];
  for (const [categoria, { precio, productos: nombres }] of Object.entries(CATALOGO)) {
    for (const nombre of nombres) {
      const minimo = rnd.int(5, 25);
      productos.push({
        id: productos.length + 1,
        nombre,
        categoria,
        precio: Math.round((precio[0] + rnd.next() * (precio[1] - precio[0])) * 2) / 2,
        stock: rnd.int(minimo + 10, minimo + 80),
        minimo,
        peso: 0,
        ultimaFecha: INICIO,
      });
    }
  }
  // Popularidad tipo Zipf: pocos productos concentran la mayoría de los movimientos
  const ranking = rnd.shuffle(productos.map((_, i) => i));
  ranking.forEach((idx, rank) => (productos[idx].peso = 1 / Math.pow(rank + 1, 0.8)));
  return productos;
}

interface Movimiento {
  id: number;
  producto: Producto;
  usuario: number;
  tipo: 'entrada' | 'salida' | 'ajuste';
  cantidad: number;
  fecha: number;
  observaciones: string;
}

interface Alerta {
  id: number;
  producto: Producto;
  tipo: 'stock_bajo' | 'agotado';
  stock: number;
  fecha: number;
  estado: 'pendiente' | 'atendida' | 'cerrada';
  atencion: number | null;
}

const ALMACEN = USUARIOS.flatMap((u, i) => (u.rol === 'almacen' ? [i + 1] : []));
const ADMIN = USUARIOS.flatMap((u, i) => (u.rol === 'admin' ? [i + 1] : []));

function simular(productos: Producto[]) {
  const fechas = Array.from({ length: TOTAL_MOVIMIENTOS }, randomBusinessTime).sort((a, b) => a - b);
  const pesos = productos.map((p) => p.peso);
  const movimientos: Movimiento[] = [];
  const alertas: Alerta[] = [];
  const abiertas = new Map<number, Alerta[]>();

  for (const fecha of fechas) {
    const p = productos[rnd.weighted(pesos)];
    const antes = p.stock;
    let tipo: Movimiento['tipo'];
    let cantidad: number;
    let observaciones = '';

    if (p.stock === 0 || (p.stock < p.minimo && rnd.chance(0.7))) {
      tipo = 'entrada';
      cantidad = rnd.int(p.minimo * 2, p.minimo * 4);
      observaciones = 'Reposición por stock bajo';
    } else {
      const r = rnd.next();
      if (r < 0.04) {
        tipo = 'ajuste';
        cantidad = rnd.int(1, 3) * (rnd.chance(0.6) && p.stock > 3 ? -1 : 1);
        observaciones = rnd.pick(['Conteo físico', 'Merma por producto dañado', 'Corrección de captura']);
      } else if (r < 0.14) {
        tipo = 'entrada';
        cantidad = rnd.int(10, 40);
        observaciones = rnd.chance(0.5) ? 'Compra a proveedor' : '';
      } else {
        tipo = 'salida';
        cantidad = rnd.int(1, Math.min(p.stock, 6));
        observaciones = rnd.chance(0.2) ? 'Venta de mostrador' : '';
      }
    }

    p.stock += tipo === 'salida' ? -cantidad : cantidad;
    p.ultimaFecha = fecha;
    movimientos.push({
      id: movimientos.length + 1,
      producto: p,
      usuario: tipo === 'ajuste' ? rnd.pick(ADMIN) : rnd.pick(ALMACEN),
      tipo,
      cantidad,
      fecha,
      observaciones,
    });

    // Alertas: se generan al cruzar el mínimo y se atienden al reponer
    const lista = abiertas.get(p.id) ?? [];
    const nueva = (tipoAlerta: Alerta['tipo']) => {
      const alerta: Alerta = {
        id: alertas.length + 1, producto: p, tipo: tipoAlerta, stock: p.stock,
        fecha: fecha + 60_000, estado: 'pendiente', atencion: null,
      };
      alertas.push(alerta);
      lista.push(alerta);
    };
    if (antes >= p.minimo && p.stock < p.minimo) nueva(p.stock === 0 ? 'agotado' : 'stock_bajo');
    else if (antes > 0 && p.stock === 0) nueva('agotado');
    else if (p.stock >= p.minimo && lista.length > 0) {
      for (const alerta of lista) {
        alerta.estado = rnd.chance(0.5) ? 'cerrada' : 'atendida';
        alerta.atencion = fecha;
      }
      lista.length = 0;
    }
    abiertas.set(p.id, lista);
  }
  return { movimientos, alertas };
}

// ---------- Errores intencionales ----------

const SINONIMOS: Record<Movimiento['tipo'], string[]> = {
  entrada: ['ENTRADA', 'Entrada', ' entrada ', 'in', 'Compra'],
  salida: ['SALIDA', 'Salida', ' salida', 'out', 'Venta'],
  ajuste: ['AJUSTE', 'Ajuste ', 'ajuste'],
};

function ensuciarProducto(p: Producto): Row {
  let nombre = p.nombre;
  let categoria = p.categoria;
  let precio = p.precio.toFixed(2);
  if (rnd.chance(0.15)) nombre = nombre.toLowerCase();
  if (rnd.chance(0.1)) nombre = `  ${nombre.replace(' ', '  ')} `;
  if (rnd.chance(0.35)) {
    categoria = rnd.pick([categoria.toLowerCase(), categoria.toUpperCase(), slug(categoria), ` ${categoria}  `]);
  }
  if (rnd.chance(0.1)) precio = `$${precio}`;
  return {
    id_producto: String(p.id),
    nombre,
    descripcion: rnd.chance(0.7) ? `${p.nombre} - ${p.categoria.toLowerCase()}` : '',
    categoria,
    stock_actual: String(p.stock),
    stock_minimo: String(p.minimo),
    precio,
    fecha_actualizacion: isoLocal(p.ultimaFecha),
    estado: 'true',
  };
}

function fechaSucia(t: number): string {
  const p = parts(t);
  const r = rnd.next();
  if (r < 0.1) return `${p.d}/${p.m}/${p.y} ${p.H}:${p.M}`; // formato de Excel en español
  if (r < 0.2) return `${p.y}-${p.m}-${p.d} ${p.H}:${p.M}:${p.S}`; // sin zona horaria
  return isoLocal(t);
}

function cantidadSucia(m: Movimiento): string {
  const r = rnd.next();
  if (r < 0.03) return `${m.cantidad} pzas`;
  if (r < 0.05) return `${m.cantidad}.0`;
  if (r < 0.07 && m.tipo === 'salida') return `-${m.cantidad}`; // salida capturada en negativo
  return String(m.cantidad);
}

function ensuciarMovimiento(m: Movimiento): Row {
  return {
    folio: `MOV-${String(m.id).padStart(6, '0')}`,
    id_producto: String(m.producto.id),
    id_usuario: String(m.usuario),
    tipo_movimiento: rnd.chance(0.15) ? rnd.pick(SINONIMOS[m.tipo]) : m.tipo,
    cantidad: cantidadSucia(m),
    fecha_movimiento: fechaSucia(m.fecha),
    observaciones: m.observaciones === '' && rnd.chance(0.05) ? '   ' : m.observaciones,
  };
}

// Registros que no se pueden recuperar: la transformación debe descartarlos
const DEFECTOS: [number, (row: Row) => void][] = [
  [40, (r) => (r.id_producto = '')],
  [30, (r) => (r.fecha_movimiento = '')],
  [20, (r) => (r.cantidad = rnd.pick(['abc', 'N/A', '']))],
  [10, (r) => (r.fecha_movimiento = '31/02/2026 10:00')],
  [25, (r) => (r.id_producto = String(rnd.int(900, 999)))],
  [25, (r) => (r.tipo_movimiento = rnd.pick(['devolucion', 'traspaso', '?']))],
];

function main() {
  const usuarios = generarUsuarios();
  const productos = generarProductos();
  const { movimientos, alertas } = simular(productos);

  const productosRaw = productos.map(ensuciarProducto);
  // Productos repetidos en la exportación
  for (let i = 0; i < 5; i++) productosRaw.push({ ...rnd.pick(productosRaw) });

  // Un correo capturado con mayúsculas
  usuarios[4].correo = usuarios[4].correo.replace(/^./, (c) => c.toUpperCase()).replace('@stockalert', '@StockAlert');

  const movimientosRaw = movimientos.map(ensuciarMovimiento);
  const base = movimientosRaw.length;
  // Filas duplicadas (mismo folio y mismos datos)
  for (let i = 0; i < 300; i++) movimientosRaw.push({ ...movimientosRaw[rnd.int(0, base - 1)] });
  // Filas inválidas con folio propio
  let folio = 100_000;
  for (const [cantidad, romper] of DEFECTOS) {
    for (let i = 0; i < cantidad; i++) {
      const row = { ...movimientosRaw[rnd.int(0, base - 1)], folio: `MOV-${++folio}` };
      romper(row);
      movimientosRaw.push(row);
    }
  }
  rnd.shuffle(movimientosRaw);

  const alertasRaw: Row[] = alertas.map((a) => ({
    id_alerta: String(a.id),
    id_producto: String(a.producto.id),
    tipo_alerta: a.tipo,
    stock_detectado: String(a.stock),
    fecha_generacion: isoLocal(a.fecha),
    estado: a.estado,
    fecha_atencion: a.atencion === null ? '' : isoLocal(a.atencion),
  }));

  const archivos: [string, Row[]][] = [
    ['usuarios.csv', usuarios],
    ['productos.csv', productosRaw],
    ['movimientos.csv', movimientosRaw],
    ['alertas.csv', alertasRaw],
  ];

  fs.mkdirSync(RAW_DIR, { recursive: true });
  fs.mkdirSync(SAMPLE_DIR, { recursive: true });
  for (const [nombre, rows] of archivos) {
    const columnas = Object.keys(rows[0]);
    writeCsv(path.join(RAW_DIR, nombre), columnas, rows);
    // Muestra pequeña que sí se sube al repositorio
    writeCsv(path.join(SAMPLE_DIR, nombre), columnas, rows.slice(0, 50));
    console.log(`${nombre.padEnd(16)} ${String(rows.length).padStart(6)} filas`);
  }
  console.log(`\nDatos crudos en ${path.relative(process.cwd(), RAW_DIR)}`);
}

main();
