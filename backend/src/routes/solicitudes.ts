// Solicitudes de reposición de la empresa. Las crea el flujo de n8n (ver
// routes/integraciones.ts); aquí el equipo las consulta y les da seguimiento:
// pendiente → pedida (se hizo el pedido al proveedor) → recibida, o cancelada.
// Marcarla como recibida no suma stock: la mercancía se registra con un movimiento de entrada.

import { Router } from 'express';
import { empresaDe, permitir } from '../auth/sesion.js';
import { pool } from '../db.js';
import { HttpError, noEncontrado } from '../errores.js';
import { pagina, paginacion } from '../paginacion.js';
import { cuerpo, entero, enteroQuery, idRuta, opcion, opcionQuery, textoNulo } from '../validar.js';

export const solicitudes = Router();

export const ESTADOS_SOLICITUD = ['pendiente', 'pedida', 'recibida', 'cancelada'] as const;

export const COLUMNAS_SOLICITUD = `
  s.id_solicitud::int AS id_solicitud, s.id_producto, p.nombre AS producto, p.categoria,
  p.stock_actual, p.stock_minimo, s.id_alerta::int AS id_alerta, a.tipo_alerta,
  s.cantidad_sugerida, s.estado, s.notas, s.fecha_creacion, s.fecha_actualizacion`;
export const DESDE_SOLICITUD = `
  FROM solicitudes_reposicion s
  JOIN productos p ON p.id_producto = s.id_producto
  LEFT JOIN alertas a ON a.id_alerta = s.id_alerta`;

async function buscar(idEmpresa: number, id: number) {
  const { rows } = await pool.query(`SELECT ${COLUMNAS_SOLICITUD} ${DESDE_SOLICITUD} WHERE s.id_solicitud = $1 AND p.id_empresa = $2`, [
    id,
    idEmpresa,
  ]);
  if (!rows[0]) throw noEncontrado('Solicitud');
  return rows[0];
}

// GET /api/solicitudes?estado=&id_producto=&page=&limit= - de la más reciente a la más antigua
solicitudes.get('/', async (req, res) => {
  const idEmpresa = empresaDe(req);
  const estado = opcionQuery(req, 'estado', ESTADOS_SOLICITUD);
  const idProducto = enteroQuery(req, 'id_producto');
  const { page, limit, offset } = paginacion(req);

  const valores: unknown[] = [idEmpresa];
  const condiciones = ['p.id_empresa = $1'];
  if (estado) {
    valores.push(estado);
    condiciones.push(`s.estado = $${valores.length}`);
  }
  if (idProducto) {
    valores.push(idProducto);
    condiciones.push(`s.id_producto = $${valores.length}`);
  }
  const where = `WHERE ${condiciones.join(' AND ')}`;

  const [total, filas] = await Promise.all([
    pool.query<{ total: number }>(`SELECT count(*)::int AS total ${DESDE_SOLICITUD} ${where}`, valores),
    pool.query(
      `SELECT ${COLUMNAS_SOLICITUD} ${DESDE_SOLICITUD} ${where}
       ORDER BY s.fecha_creacion DESC, s.id_solicitud DESC
       LIMIT $${valores.length + 1} OFFSET $${valores.length + 2}`,
      [...valores, limit, offset],
    ),
  ]);
  res.json(pagina(filas.rows, total.rows[0].total, page, limit));
});

// GET /api/solicitudes/resumen - cuántas hay en cada estado
solicitudes.get('/resumen', async (req, res) => {
  const { rows } = await pool.query<{ estado: string; total: number }>(
    `SELECT s.estado, count(*)::int AS total ${DESDE_SOLICITUD} WHERE p.id_empresa = $1 GROUP BY s.estado`,
    [empresaDe(req)],
  );
  res.json(Object.fromEntries(ESTADOS_SOLICITUD.map((e) => [e, rows.find((r) => r.estado === e)?.total ?? 0])));
});

// GET /api/solicitudes/:id
solicitudes.get('/:id', async (req, res) => {
  res.json(await buscar(empresaDe(req), idRuta(req, 'Solicitud')));
});

// PATCH /api/solicitudes/:id - { estado?, cantidad_sugerida?, notas? }
solicitudes.patch('/:id', permitir('admin', 'almacen'), async (req, res) => {
  const idEmpresa = empresaDe(req);
  const id = idRuta(req, 'Solicitud');
  const b = cuerpo(req);
  const cambios: [string, unknown][] = [];
  const estado = opcion(b, 'estado', ESTADOS_SOLICITUD);
  const cantidad = entero(b, 'cantidad_sugerida', { min: 1, max: 1_000_000 });
  const notas = textoNulo(b, 'notas', 1000);
  if (estado !== undefined) cambios.push(['estado', estado]);
  if (cantidad !== undefined) cambios.push(['cantidad_sugerida', cantidad]);
  if (notas !== undefined) cambios.push(['notas', notas]);
  if (!cambios.length) throw new HttpError(400, 'Envía al menos un campo: estado, cantidad_sugerida o notas');

  const { rowCount } = await pool.query(
    `UPDATE solicitudes_reposicion s SET ${cambios.map(([c], i) => `${c} = $${i + 1}`).join(', ')}, fecha_actualizacion = now()
     FROM productos p
     WHERE s.id_solicitud = $${cambios.length + 1} AND p.id_producto = s.id_producto AND p.id_empresa = $${cambios.length + 2}`,
    [...cambios.map(([, v]) => v), id, idEmpresa],
  );
  if (!rowCount) throw noEncontrado('Solicitud');
  res.json(await buscar(idEmpresa, id));
});
