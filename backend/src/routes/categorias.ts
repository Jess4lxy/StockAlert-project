import { Router } from 'express';
import { pool } from '../db.js';

export const categorias = Router();

// GET /api/categorias - opciones para el filtro de la pantalla
categorias.get('/', async (_req, res) => {
  const { rows } = await pool.query<{ categoria: string }>(
    'SELECT DISTINCT categoria FROM productos WHERE categoria IS NOT NULL ORDER BY categoria',
  );
  res.json(rows.map((r) => r.categoria));
});
