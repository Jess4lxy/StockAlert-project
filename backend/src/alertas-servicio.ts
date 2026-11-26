// Reglas de alertas: las mismas que usa la simulación del ETL (etl/src/generate.ts).
//   - Se genera una alerta cuando el stock queda por debajo del mínimo y el producto
//     no tiene alertas pendientes ('agotado' si llegó a 0, si no 'stock_bajo').
//   - Si el stock llega a 0 y la pendiente era de stock bajo, se genera además la de agotado.
//   - Al reponer (stock >= mínimo), las pendientes pasan a 'atendida'.
// Al generarse una alerta se avisa a n8n (si N8N_WEBHOOK_URL está definido).

import type pg from 'pg';
import { config } from './config.js';
import { pool } from './db.js';

export interface AlertaGenerada {
  id_alerta: number;
  id_producto: number;
  tipo_alerta: 'stock_bajo' | 'agotado';
  stock_detectado: number;
  fecha_generacion: string;
  estado: 'pendiente';
}

interface ProductoStock {
  id_producto: number;
  stock_actual: number;
  stock_minimo: number;
}

// Debe ejecutarse dentro de la misma transacción que cambió el stock o el mínimo
export async function evaluarAlertas(
  client: pg.PoolClient,
  p: ProductoStock,
  stockAnterior: number | null,
): Promise<{ generada: AlertaGenerada | null; atendidas: number }> {
  if (p.stock_actual >= p.stock_minimo) {
    const { rowCount } = await client.query(
      `UPDATE alertas SET estado = 'atendida', fecha_atencion = now()
       WHERE id_producto = $1 AND estado = 'pendiente'`,
      [p.id_producto],
    );
    return { generada: null, atendidas: rowCount ?? 0 };
  }

  const { rows: pendientes } = await client.query<{ tipo_alerta: string }>(
    `SELECT tipo_alerta FROM alertas WHERE id_producto = $1 AND estado = 'pendiente'`,
    [p.id_producto],
  );
  const agotado = p.stock_actual === 0;
  const generar =
    pendientes.length === 0 ||
    (agotado && stockAnterior !== null && stockAnterior > 0 && !pendientes.some((a) => a.tipo_alerta === 'agotado'));
  if (!generar) return { generada: null, atendidas: 0 };

  const { rows } = await client.query<AlertaGenerada>(
    `INSERT INTO alertas (id_producto, tipo_alerta, stock_detectado)
     VALUES ($1, $2, $3)
     RETURNING id_alerta::int AS id_alerta, id_producto, tipo_alerta, stock_detectado, fecha_generacion, estado`,
    [p.id_producto, agotado ? 'agotado' : 'stock_bajo', p.stock_actual],
  );
  return { generada: rows[0], atendidas: 0 };
}

// Cantidad que conviene pedir: lo necesario para llegar al doble del mínimo (así no
// vuelve a quedar por debajo con la siguiente venta). Siempre al menos 1.
export function cantidadSugerida(stockActual: number, stockMinimo: number): number {
  return Math.max(1, stockMinimo * 2 - stockActual);
}

// Datos completos del aviso: el producto siempre con la misma forma, la empresa con sus
// administradores activos (a quién avisar) y la cantidad sugerida para reponer
async function datosDelAviso(idProducto: number, idEmpresa: number) {
  const [producto, empresa] = await Promise.all([
    pool.query<{ id_producto: number; nombre: string; categoria: string | null; stock_actual: number; stock_minimo: number; faltante: number }>(
      `SELECT id_producto, nombre, categoria, stock_actual, stock_minimo, stock_minimo - stock_actual AS faltante
       FROM productos WHERE id_producto = $1`,
      [idProducto],
    ),
    pool.query<{ id_empresa: number; nombre: string; admins: { nombre: string; correo: string }[] }>(
      `SELECT e.id_empresa, e.nombre,
              coalesce(json_agg(json_build_object('nombre', u.nombre, 'correo', u.correo) ORDER BY u.nombre)
                       FILTER (WHERE u.id_usuario IS NOT NULL), '[]') AS admins
       FROM empresas e
       LEFT JOIN usuarios_empresas ue ON ue.id_empresa = e.id_empresa AND ue.rol = 'admin' AND ue.estado
       LEFT JOIN usuarios u ON u.id_usuario = ue.id_usuario AND u.estado
       WHERE e.id_empresa = $1
       GROUP BY e.id_empresa, e.nombre`,
      [idEmpresa],
    ),
  ]);
  return { producto: producto.rows[0], empresa: empresa.rows[0] };
}

// Aviso a n8n después de confirmar la transacción. Se espera la respuesta (máximo
// 3 s) porque en Vercel la función puede congelarse al responder; si n8n falla,
// la operación del usuario no se revierte: solo se registra en el log.
// Cuerpo: { evento, alerta, producto, empresa: { ..., admins }, reposicion: { cantidad_sugerida } }.
// Con él, el flujo avisa por correo a los admins y registra la solicitud de reposición
// con POST /api/integraciones/n8n/solicitudes.
export async function notificarN8n(alerta: AlertaGenerada, idEmpresa: number): Promise<boolean> {
  if (!config.n8n.url) return false;
  try {
    const { producto, empresa } = await datosDelAviso(alerta.id_producto, idEmpresa);
    const res = await fetch(config.n8n.url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(config.n8n.token ? { 'X-StockAlert-Token': config.n8n.token } : {}),
      },
      body: JSON.stringify({
        evento: 'alerta.generada',
        alerta,
        producto,
        empresa,
        reposicion: { cantidad_sugerida: cantidadSugerida(producto.stock_actual, producto.stock_minimo) },
      }),
      signal: AbortSignal.timeout(3000),
    });
    if (!res.ok) console.error(`n8n respondió ${res.status} al avisar la alerta ${alerta.id_alerta}`);
    return res.ok;
  } catch (error) {
    console.error(`No se pudo avisar a n8n la alerta ${alerta.id_alerta}:`, (error as Error).message);
    return false;
  }
}
