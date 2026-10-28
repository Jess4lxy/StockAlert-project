import cors from 'cors';
import express, { type ErrorRequestHandler } from 'express';
import { config } from './config.js';
import { categorias } from './routes/categorias.js';
import { dashboard } from './routes/dashboard.js';
import { movimientos } from './routes/movimientos.js';

const app = express();
app.use(cors({ origin: config.corsOrigin }));
app.use(express.json());

app.get('/api/salud', (_req, res) => {
  res.json({ ok: true });
});
app.use('/api/movimientos', movimientos);
app.use('/api/categorias', categorias);
app.use('/api/dashboard', dashboard);

// Express 5 envía aquí los errores de las rutas async
const manejarError: ErrorRequestHandler = (error, _req, res, _next) => {
  console.error(error);
  res.status(500).json({ error: 'Error interno del servidor' });
};
app.use(manejarError);

app.listen(config.port, () => {
  console.log(`API de StockAlert en http://localhost:${config.port}/api`);
});
