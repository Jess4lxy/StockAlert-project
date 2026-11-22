import { Router } from 'express';
import { empresaDe } from '../auth/sesion.js';
import { pool } from '../db.js';

export const categorias = Router();

// GET /api/categorias - categorías de los productos de la empresa, para los filtros
categorias.get('/', async (req, res) => {
  const { rows } = await pool.query<{ categoria: string }>(
    'SELECT DISTINCT categoria FROM productos WHERE id_empresa = $1 AND categoria IS NOT NULL ORDER BY categoria',
    [empresaDe(req)],
  );
  res.json(rows.map((r) => r.categoria));
});
