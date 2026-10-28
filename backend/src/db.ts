import pg from 'pg';
import { config } from './config.js';

// Los NUMERIC (precio) llegan como texto por defecto; se convierten a número
pg.types.setTypeParser(pg.types.builtins.NUMERIC, Number);
// BIGINT (id de movimientos y alertas) también como número: los valores caben de sobra
pg.types.setTypeParser(pg.types.builtins.INT8, Number);

export const pool = new pg.Pool({ connectionString: config.databaseUrl, max: 10 });
