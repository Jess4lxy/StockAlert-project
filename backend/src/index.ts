import cors from 'cors';
import express, { type ErrorRequestHandler } from 'express';
import { config } from './config.js';
import { alertas } from './routes/alertas.js';
import { categorias } from './routes/categorias.js';
import { dashboard } from './routes/dashboard.js';
import { movimientos } from './routes/movimientos.js';
import { productos } from './routes/productos.js';

const app = express();
app.use(cors({ origin: config.corsOrigin }));
app.use(express.json());

app.get('/api/salud', (_req, res) => {
  res.json({ ok: true });
});
app.use('/api/movimientos', movimientos);
app.use('/api/categorias', categorias);
app.use('/api/dashboard', dashboard);
app.use('/api/productos', productos);
app.use('/api/alertas', alertas);

// Express 5 envía aquí los errores de las rutas async
const manejarError: ErrorRequestHandler = (error, _req, res, _next) => {
  console.error(error);
  res.status(500).json({ error: 'Error interno del servidor' });
};
app.use(manejarError);

// En Vercel la plataforma recibe las peticiones e importa la app; el puerto solo se
// abre al correr la API en la computadora (npm run dev)
if (!process.env.VERCEL) {
  app.listen(config.port, () => {
    console.log(`API de StockAlert en http://localhost:${config.port}/api`);
  });
}

export default app;
