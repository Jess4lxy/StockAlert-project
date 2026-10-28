// Paso 3 del ETL: recrea el esquema (db/schema.sql) y carga los CSV limpios en
// PostgreSQL dentro de una sola transacción. Si algo falla no queda nada a medias.
// Al terminar muestra el conteo final de cada tabla.

import fs from 'node:fs';
import path from 'node:path';
import pg from 'pg';
import { CLEAN_DIR, SCHEMA_FILE, databaseUrl } from './config.js';
import { readCsv, type Row } from './csv.js';

const LOTE = 1000;

// Orden de carga: primero las tablas a las que apuntan las llaves foráneas
const TABLAS: { tabla: string; id: string; columnas: string[] }[] = [
  {
    tabla: 'usuarios', id: 'id_usuario',
    columnas: ['id_usuario', 'nombre', 'correo', 'contrasena_hash', 'rol', 'fecha_registro', 'estado'],
  },
  {
    tabla: 'productos', id: 'id_producto',
    columnas: ['id_producto', 'nombre', 'descripcion', 'categoria', 'stock_actual', 'stock_minimo', 'precio', 'fecha_actualizacion', 'estado'],
  },
  {
    tabla: 'movimientos', id: 'id_movimiento',
    columnas: ['id_movimiento', 'id_producto', 'id_usuario', 'tipo_movimiento', 'cantidad', 'fecha_movimiento', 'observaciones'],
  },
  {
    tabla: 'alertas', id: 'id_alerta',
    columnas: ['id_alerta', 'id_producto', 'tipo_alerta', 'stock_detectado', 'fecha_generacion', 'estado', 'fecha_atencion'],
  },
];

async function insertarEnLotes(client: pg.PoolClient, tabla: string, columnas: string[], rows: Row[]) {
  for (let i = 0; i < rows.length; i += LOTE) {
    const lote = rows.slice(i, i + LOTE);
    const valores: (string | null)[] = [];
    const filas = lote.map((row, r) => {
      // Celda vacía en el CSV = NULL en la base
      columnas.forEach((c) => valores.push(row[c] === '' ? null : row[c]));
      return `(${columnas.map((_, c) => `$${r * columnas.length + c + 1}`).join(', ')})`;
    });
    await client.query(`INSERT INTO ${tabla} (${columnas.join(', ')}) VALUES ${filas.join(', ')}`, valores);
  }
}

async function main() {
  if (!fs.existsSync(path.join(CLEAN_DIR, 'movimientos.csv'))) {
    throw new Error('No hay datos limpios. Ejecuta primero: npm run generate && npm run transform');
  }

  const pool = new pg.Pool({ connectionString: databaseUrl() });
  const client = await pool.connect();
  const inicio = performance.now();
  try {
    await client.query('BEGIN');
    await client.query(fs.readFileSync(SCHEMA_FILE, 'utf8'));

    for (const { tabla, id, columnas } of TABLAS) {
      const rows = readCsv(path.join(CLEAN_DIR, `${tabla}.csv`));
      await insertarEnLotes(client, tabla, columnas, rows);
      // Los id se insertaron explícitamente: el contador de identidad sigue después del último
      await client.query(`SELECT setval(pg_get_serial_sequence('${tabla}', '${id}'), (SELECT max(${id}) FROM ${tabla}))`);
    }

    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  }

  const segundos = ((performance.now() - inicio) / 1000).toFixed(2);
  const { rows } = await client.query(`
    SELECT 'usuarios' AS tabla, count(*)::int AS registros FROM usuarios
    UNION ALL SELECT 'productos', count(*)::int FROM productos
    UNION ALL SELECT 'movimientos', count(*)::int FROM movimientos
    UNION ALL SELECT 'alertas', count(*)::int FROM alertas`);
  console.log(`Carga completa en ${segundos} s. Registros en la base:`);
  console.table(rows);

  client.release();
  await pool.end();
}

main().catch((error) => {
  console.error('Error en la carga:', error.message);
  process.exitCode = 1;
});
