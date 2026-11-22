import { Router } from 'express';
import { openapi } from '../openapi.js';

export const docs = Router();

// Versión fija de Swagger UI, servida desde un CDN: no agrega dependencias ni
// archivos estáticos a la función de Vercel
const SWAGGER_UI = 'https://cdn.jsdelivr.net/npm/swagger-ui-dist@5.17.14';

const pagina = `<!doctype html>
<html lang="es">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>StockAlert API · Documentación</title>
  <link rel="stylesheet" href="${SWAGGER_UI}/swagger-ui.css">
  <style>body { margin: 0; } .swagger-ui .topbar { display: none; }</style>
</head>
<body>
  <div id="swagger"></div>
  <script src="${SWAGGER_UI}/swagger-ui-bundle.js"></script>
  <script>
    SwaggerUIBundle({ url: '/api/openapi.json', dom_id: '#swagger', deepLinking: true, tryItOutEnabled: true });
  </script>
</body>
</html>`;

// GET /api/openapi.json - especificación OpenAPI (para Postman, generadores de clientes, etc.)
docs.get('/openapi.json', (_req, res) => {
  res.json(openapi);
});

// GET /api/docs - Swagger UI para leer y probar los endpoints
docs.get('/docs', (_req, res) => {
  res.type('html').send(pagina);
});
