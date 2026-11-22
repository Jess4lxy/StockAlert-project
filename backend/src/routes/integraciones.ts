// Endpoints para servicios externos (no para personas). No usan el token de sesión:
// n8n se identifica con el encabezado X-StockAlert-Token, el mismo valor que la API le
// envía en cada aviso (N8N_WEBHOOK_TOKEN).

import crypto from 'node:crypto';
import { Router, type RequestHandler } from 'express';
import { cantidadSugerida } from '../alertas-servicio.js';
import { config } from '../config.js';
import { pool } from '../db.js';
import { HttpError, noEncontrado } from '../errores.js';
import { cuerpo, entero, texto } from '../validar.js';
import { COLUMNAS_SOLICITUD, DESDE_SOLICITUD } from './solicitudes.js';

export const integraciones = Router();

const autenticarN8n: RequestHandler = (req, _res, next) => {
  const esperado = config.n8n.token;
  if (!esperado) throw new HttpError(503, 'La integración con n8n no está configurada (falta N8N_WEBHOOK_TOKEN)');
  const recibido = req.get('X-StockAlert-Token') ?? '';
  // Comparación en tiempo constante (sobre los hashes, que siempre miden lo mismo)
  const igual = crypto.timingSafeEqual(
    crypto.createHash('sha256').update(recibido).digest(),
    crypto.createHash('sha256').update(esperado).digest(),
  );
  if (!igual) throw new HttpError(401, 'X-StockAlert-Token inválido');
  next();
};

// POST /api/integraciones/n8n/solicitudes - { id_alerta, cantidad_sugerida?, notas? }
// Registra la solicitud de reposición de una alerta. Es idempotente: si n8n reintenta,
// la misma alerta devuelve la solicitud que ya existía (200) en lugar de duplicarla.
integraciones.post('/n8n/solicitudes', autenticarN8n, async (req, res) => {
  const b = cuerpo(req);
  const idAlerta = entero(b, 'id_alerta', { requerido: true, min: 1 })!;
  const cantidad = entero(b, 'cantidad_sugerida', { min: 1, max: 1_000_000 });
  const notas = texto(b, 'notas', { max: 1000 }) ?? null;

  const { rows: alertas } = await pool.query<{ id_producto: number; stock_actual: number; stock_minimo: number }>(
    `SELECT a.id_producto, p.stock_actual, p.stock_minimo
     FROM alertas a JOIN productos p ON p.id_producto = a.id_producto WHERE a.id_alerta = $1`,
    [idAlerta],
  );
  const alerta = alertas[0];
  if (!alerta) throw noEncontrado('Alerta');

  const { rows } = await pool.query<{ id_solicitud: number }>(
    `INSERT INTO solicitudes_reposicion (id_producto, id_alerta, cantidad_sugerida, notas)
     VALUES ($1, $2, $3, $4)
     ON CONFLICT (id_alerta) DO NOTHING
     RETURNING id_solicitud`,
    [alerta.id_producto, idAlerta, cantidad ?? cantidadSugerida(alerta.stock_actual, alerta.stock_minimo), notas],
  );
  const creada = rows.length > 0;
  const { rows: solicitud } = await pool.query(`SELECT ${COLUMNAS_SOLICITUD} ${DESDE_SOLICITUD} WHERE s.id_alerta = $1`, [idAlerta]);
  res.status(creada ? 201 : 200).json(solicitud[0]);
});
