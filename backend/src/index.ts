import cors from 'cors';
import express from 'express';
import { autenticar, permitir } from './auth/sesion.js';
import { config } from './config.js';
import { manejarError } from './errores.js';
import { alertas } from './routes/alertas.js';
import { auth } from './routes/auth.js';
import { categorias } from './routes/categorias.js';
import { dashboard } from './routes/dashboard.js';
import { docs } from './routes/docs.js';
import { empresas } from './routes/empresas.js';
import { integraciones } from './routes/integraciones.js';
import { movimientos } from './routes/movimientos.js';
import { productos } from './routes/productos.js';
import { solicitudes } from './routes/solicitudes.js';
import { usuarios } from './routes/usuarios.js';

const app = express();
// credentials: la web manda la cookie del refresh token (en local, front y API están en
// puertos distintos; en Vercel comparten dominio)
app.use(cors({ origin: config.corsOrigin, credentials: true }));
app.use(express.json({ limit: '100kb' }));

// Públicos: estado del servicio, sesión (login, registro, refresh, logout) y documentación
app.get('/api/salud', (_req, res) => {
  res.json({ ok: true });
});
app.use('/api/auth', auth);
app.use('/api', docs);
// Servicios externos: n8n se autentica con su propio token (X-StockAlert-Token)
app.use('/api/integraciones', integraciones);

// Todo lo demás exige sesión (Authorization: Bearer <token>)
app.use('/api', autenticar);
app.use('/api/empresas', permitir('plataforma'), empresas);
app.use('/api/usuarios', permitir('plataforma', 'admin'), usuarios);
// Inventario de la empresa del usuario (la plataforma no tiene inventario propio)
app.use('/api/productos', productos);
app.use('/api/movimientos', movimientos);
app.use('/api/alertas', alertas);
app.use('/api/solicitudes', solicitudes);
app.use('/api/categorias', categorias);
app.use('/api/dashboard', dashboard);

app.use('/api', (_req, res) => {
  res.status(404).json({ error: 'Ruta no encontrada' });
});
// Express 5 envía aquí los errores de las rutas async
app.use(manejarError);

// En Vercel la plataforma recibe las peticiones e importa la app; el puerto solo se
// abre al correr la API en la computadora (npm run dev)
if (!process.env.VERCEL) {
  app.listen(config.port, () => {
    console.log(`API de StockAlert en http://localhost:${config.port}/api`);
  });
}

export default app;
