import { Router } from 'express';
import { empresaDe, permitir } from '../auth/sesion.js';
import { pool } from '../db.js';
import { noEncontrado } from '../errores.js';
import { pagina, paginacion } from '../paginacion.js';
import { cuerpo, enteroQuery, idRuta, opcion, opcionQuery } from '../validar.js';

export const alertas = Router();

const ESTADOS = ['pendiente', 'atendida', 'cerrada'] as const;
const TIPOS = ['stock_bajo', 'agotado'] as const;

const COLUMNAS = `
  a.id_alerta::int AS id_alerta, a.id_producto, p.nombre AS producto, p.categoria,
  a.tipo_alerta, a.stock_detectado, a.fecha_generacion, a.estado, a.fecha_atencion`;

async function buscar(idEmpresa: number, id: number) {
  const { rows } = await pool.query(
    `SELECT ${COLUMNAS} FROM alertas a JOIN productos p ON p.id_producto = a.id_producto
     WHERE a.id_alerta = $1 AND p.id_empresa = $2`,
    [id, idEmpresa],
  );
  if (!rows[0]) throw noEncontrado('Alerta');
  return rows[0];
}

// GET /api/alertas/resumen - totales para las tarjetas de la pantalla
alertas.get('/resumen', async (req, res) => {
  const { rows } = await pool.query<{ pendientes: number; total: number }>(
    `SELECT count(*) FILTER (WHERE a.estado = 'pendiente')::int AS pendientes, count(*)::int AS total
     FROM alertas a JOIN productos p ON p.id_producto = a.id_producto
     WHERE p.id_empresa = $1`,
    [empresaDe(req)],
  );
  res.json(rows[0]);
});

// GET /api/alertas?estado=&tipo=&id_producto=&page=&limit= - de la más reciente a la más antigua
alertas.get('/', async (req, res) => {
  const idEmpresa = empresaDe(req);
  const estado = opcionQuery(req, 'estado', ESTADOS);
  const tipo = opcionQuery(req, 'tipo', TIPOS);
  const idProducto = enteroQuery(req, 'id_producto');
  const { page, limit, offset } = paginacion(req);

  const valores: unknown[] = [idEmpresa];
  const condiciones = ['p.id_empresa = $1'];
  for (const [columna, valor] of [
    ['a.estado', estado],
    ['a.tipo_alerta', tipo],
    ['a.id_producto', idProducto],
  ] as const) {
    if (valor === undefined) continue;
    valores.push(valor);
    condiciones.push(`${columna} = $${valores.length}`);
  }
  const desde = `FROM alertas a JOIN productos p ON p.id_producto = a.id_producto WHERE ${condiciones.join(' AND ')}`;

  const [total, filas] = await Promise.all([
    pool.query<{ total: number }>(`SELECT count(*)::int AS total ${desde}`, valores),
    pool.query(
      `SELECT ${COLUMNAS} ${desde}
       ORDER BY a.fecha_generacion DESC, a.id_alerta DESC
       LIMIT $${valores.length + 1} OFFSET $${valores.length + 2}`,
      [...valores, limit, offset],
    ),
  ]);
  res.json(pagina(filas.rows, total.rows[0].total, page, limit));
});

// GET /api/alertas/:id
alertas.get('/:id', async (req, res) => {
  res.json(await buscar(empresaDe(req), idRuta(req, 'Alerta')));
});

// PATCH /api/alertas/:id - { estado }
// atendida: se resolvió (las de un producto repuesto se atienden solas al registrar la entrada)
// cerrada: se descarta sin reponer · pendiente: se reabre
alertas.patch('/:id', permitir('admin', 'almacen'), async (req, res) => {
  const idEmpresa = empresaDe(req);
  const id = idRuta(req, 'Alerta');
  const estado = opcion(cuerpo(req), 'estado', ESTADOS, { requerido: true })!;
  const { rowCount } = await pool.query(
    `UPDATE alertas a SET estado = $1, fecha_atencion = CASE WHEN $4 THEN NULL ELSE now() END
     FROM productos p
     WHERE a.id_alerta = $2 AND p.id_producto = a.id_producto AND p.id_empresa = $3`,
    [estado, id, idEmpresa, estado === 'pendiente'],
  );
  if (!rowCount) throw noEncontrado('Alerta');
  res.json(await buscar(idEmpresa, id));
});
