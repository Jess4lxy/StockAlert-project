// Reglas de alertas: las mismas que usa la simulación del ETL (etl/src/generate.ts).
//   - Se genera una alerta cuando el stock queda por debajo del mínimo y el producto
//     no tiene alertas pendientes ('agotado' si llegó a 0, si no 'stock_bajo').
//   - Si el stock llega a 0 y la pendiente era de stock bajo, se genera además la de agotado.
//   - Al reponer (stock >= mínimo), las pendientes pasan a 'atendida'.
// Al generarse una alerta se avisa a n8n (si N8N_WEBHOOK_URL está definido).

import type pg from 'pg';
import { config } from './config.js';

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

// Aviso a n8n después de confirmar la transacción. Se espera la respuesta (máximo
// 3 s) porque en Vercel la función puede congelarse al responder; si n8n falla,
// la operación del usuario no se revierte: solo se registra en el log.
export async function notificarN8n(
  alerta: AlertaGenerada,
  producto: { id_producto: number; nombre: string; categoria: string | null; stock_actual: number; stock_minimo: number },
  empresa: { id_empresa: number; nombre: string },
): Promise<boolean> {
  if (!config.n8n.url) return false;
  try {
    const res = await fetch(config.n8n.url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(config.n8n.token ? { 'X-StockAlert-Token': config.n8n.token } : {}),
      },
      body: JSON.stringify({ evento: 'alerta.generada', alerta, producto, empresa }),
      signal: AbortSignal.timeout(3000),
    });
    if (!res.ok) console.error(`n8n respondió ${res.status} al avisar la alerta ${alerta.id_alerta}`);
    return res.ok;
  } catch (error) {
    console.error(`No se pudo avisar a n8n la alerta ${alerta.id_alerta}:`, (error as Error).message);
    return false;
  }
}
