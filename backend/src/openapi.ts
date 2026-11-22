// Especificación OpenAPI 3.1 de la API de StockAlert. Se sirve en /api/openapi.json
// y la interfaz de Swagger en /api/docs (ver routes/docs.ts). Al agregar o cambiar
// un endpoint, actualizar aquí sus parámetros y su respuesta.

const errorRespuesta = (ejemplo: string) => ({
  description: 'Parámetro con un valor no permitido',
  content: {
    'application/json': {
      schema: { $ref: '#/components/schemas/Error' },
      example: { error: ejemplo },
    },
  },
});

const error500 = {
  description: 'Error interno (por ejemplo, la base de datos no responde)',
  content: {
    'application/json': {
      schema: { $ref: '#/components/schemas/Error' },
      example: { error: 'Error interno del servidor' },
    },
  },
};

const paginaDe = (item: string) => ({
  type: 'object',
  required: ['data', 'page', 'limit', 'total', 'totalPages'],
  properties: {
    data: { type: 'array', items: { $ref: `#/components/schemas/${item}` } },
    page: { type: 'integer', description: 'Página devuelta', example: 1 },
    limit: { type: 'integer', description: 'Registros por página', example: 20 },
    total: { type: 'integer', description: 'Registros que cumplen los filtros (en todas las páginas)' },
    totalPages: { type: 'integer', description: 'Número de páginas; mínimo 1 aunque no haya registros' },
  },
});

export const openapi = {
  openapi: '3.1.0',
  info: {
    title: 'StockAlert API',
    version: '1.0.0',
    description: [
      'API REST de **StockAlert**, inventario inteligente para pequeños negocios.',
      '',
      '- Es de **solo consulta**: todos los endpoints son `GET` y la API se conecta a PostgreSQL con un usuario de solo lectura.',
      '- No requiere autenticación.',
      '- Los datos son **ficticios** (un año simulado de una tienda: 93 productos, 10,000 movimientos y 208 alertas).',
      '- Búsqueda, filtros y paginación se resuelven en el servidor: cada respuesta trae solo la página pedida.',
      '- Las fechas van en ISO 8601 (UTC). El negocio está en Mérida (UTC−6).',
      '- Paginación: `limit` acepta 10, 20, 50 o 100 (otro valor usa 20) y `page` empieza en 1 (un valor inválido usa 1).',
    ].join('\n'),
  },
  servers: [
    { url: '/api', description: 'Mismo servidor que esta documentación' },
    { url: 'https://stockalert-beta.vercel.app/api', description: 'Producción (Vercel)' },
    { url: 'http://localhost:3000/api', description: 'Desarrollo local (npm run dev)' },
  ],
  tags: [
    { name: 'Productos', description: 'Catálogo con stock actual contra mínimo' },
    { name: 'Movimientos', description: 'Entradas, salidas y ajustes de inventario' },
    { name: 'Alertas', description: 'Alertas de stock bajo o agotado' },
    { name: 'Dashboard', description: 'Indicadores y datos de las gráficas' },
    { name: 'Catálogos', description: 'Listas para los filtros' },
    { name: 'Sistema', description: 'Estado del servicio' },
  ],
  paths: {
    '/productos': {
      get: {
        tags: ['Productos'],
        summary: 'Listar productos',
        description:
          'Productos activos, ordenados por faltante (stock mínimo − stock actual) de mayor a menor y después por nombre. ' +
          'Así los que más urge reponer salen primero.',
        operationId: 'listarProductos',
        parameters: [
          { $ref: '#/components/parameters/q' },
          {
            name: 'estado',
            in: 'query',
            description:
              'Estado del stock:\n' +
              '- `reponer`: por debajo del mínimo o agotados\n' +
              '- `bajo`: con existencias pero por debajo del mínimo\n' +
              '- `agotado`: stock en 0\n' +
              '- `ok`: en o por encima del mínimo',
            schema: { type: 'string', enum: ['reponer', 'bajo', 'agotado', 'ok'] },
          },
          { $ref: '#/components/parameters/categoria' },
          { $ref: '#/components/parameters/page' },
          { $ref: '#/components/parameters/limit' },
        ],
        responses: {
          200: {
            description: 'Página de productos',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/PaginaProductos' },
                example: {
                  data: [
                    {
                      id_producto: 10,
                      nombre: 'Hojas blancas paquete 500',
                      categoria: 'Papelería',
                      stock_actual: 5,
                      stock_minimo: 10,
                      precio: 77.5,
                      fecha_actualizacion: '2026-10-26T22:23:00.000Z',
                      estado_stock: 'bajo',
                    },
                  ],
                  page: 1,
                  limit: 20,
                  total: 93,
                  totalPages: 5,
                },
              },
            },
          },
          400: errorRespuesta('estado debe ser uno de: reponer, bajo, agotado, ok'),
          500: error500,
        },
      },
    },
    '/movimientos': {
      get: {
        tags: ['Movimientos'],
        summary: 'Listar movimientos de inventario',
        description:
          'Historial de entradas, salidas y ajustes, del más reciente al más antiguo. ' +
          'La respuesta incluye el encabezado `Server-Timing: db;dur=<ms>` con el tiempo de las consultas en PostgreSQL.',
        operationId: 'listarMovimientos',
        parameters: [
          { $ref: '#/components/parameters/q' },
          {
            name: 'tipo',
            in: 'query',
            description: 'Tipo de movimiento',
            schema: { type: 'string', enum: ['entrada', 'salida', 'ajuste'] },
          },
          { $ref: '#/components/parameters/categoria' },
          { $ref: '#/components/parameters/page' },
          { $ref: '#/components/parameters/limit' },
        ],
        responses: {
          200: {
            description: 'Página de movimientos',
            headers: {
              'Server-Timing': {
                description: 'Tiempo de las consultas en la base de datos, por ejemplo `db;dur=2.41`',
                schema: { type: 'string' },
              },
            },
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/PaginaMovimientos' },
                example: {
                  data: [
                    {
                      id_movimiento: 9995,
                      fecha_movimiento: '2026-10-28T00:04:00.000Z',
                      tipo_movimiento: 'salida',
                      cantidad: 6,
                      observaciones: null,
                      id_producto: 1,
                      producto: 'Cuaderno profesional 100 hojas',
                      categoria: 'Papelería',
                      usuario: 'Miguel Balam Can',
                    },
                  ],
                  page: 1,
                  limit: 10,
                  total: 706,
                  totalPages: 71,
                },
              },
            },
          },
          400: errorRespuesta('tipo debe ser uno de: entrada, salida, ajuste'),
          500: error500,
        },
      },
    },
    '/alertas': {
      get: {
        tags: ['Alertas'],
        summary: 'Listar alertas',
        description: 'Alertas de stock, de la más reciente a la más antigua.',
        operationId: 'listarAlertas',
        parameters: [
          {
            name: 'estado',
            in: 'query',
            description: 'Estado de la alerta',
            schema: { type: 'string', enum: ['pendiente', 'atendida', 'cerrada'] },
          },
          {
            name: 'tipo',
            in: 'query',
            description: 'Tipo de alerta',
            schema: { type: 'string', enum: ['stock_bajo', 'agotado'] },
          },
          { $ref: '#/components/parameters/page' },
          { $ref: '#/components/parameters/limit' },
        ],
        responses: {
          200: {
            description: 'Página de alertas',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/PaginaAlertas' },
                example: {
                  data: [
                    {
                      id_alerta: 208,
                      id_producto: 43,
                      producto: 'Refresco de cola 600 ml',
                      categoria: 'Bebidas',
                      tipo_alerta: 'stock_bajo',
                      stock_detectado: 19,
                      fecha_generacion: '2026-10-27T23:06:00.000Z',
                      estado: 'pendiente',
                      fecha_atencion: null,
                    },
                  ],
                  page: 1,
                  limit: 20,
                  total: 208,
                  totalPages: 11,
                },
              },
            },
          },
          400: errorRespuesta('estado debe ser uno de: pendiente, atendida, cerrada'),
          500: error500,
        },
      },
    },
    '/alertas/resumen': {
      get: {
        tags: ['Alertas'],
        summary: 'Totales de alertas',
        description: 'Número de alertas pendientes y total registrado, para las tarjetas de la pantalla de alertas.',
        operationId: 'resumenAlertas',
        responses: {
          200: {
            description: 'Totales',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  required: ['pendientes', 'total'],
                  properties: {
                    pendientes: { type: 'integer', description: 'Alertas con estado pendiente' },
                    total: { type: 'integer', description: 'Todas las alertas registradas' },
                  },
                },
                example: { pendientes: 4, total: 208 },
              },
            },
          },
          500: error500,
        },
      },
    },
    '/dashboard': {
      get: {
        tags: ['Dashboard'],
        summary: 'Indicadores del dashboard',
        description:
          'Indicadores de los últimos `meses` meses calendario, contando el mes del último movimiento registrado ' +
          '(con datos ficticios, "hoy" es el final del historial). Incluye los datos de las dos gráficas y la tabla ' +
          'de productos por reponer.',
        operationId: 'obtenerDashboard',
        parameters: [
          {
            name: 'meses',
            in: 'query',
            description: 'Periodo en meses. Otro valor usa 6.',
            schema: { type: 'integer', enum: [3, 6, 12], default: 6 },
          },
        ],
        responses: {
          200: {
            description: 'Indicadores del periodo',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/Dashboard' },
                example: {
                  meses: 3,
                  periodo: { inicio: '2026-08-01T06:00:00.000Z', fin: '2026-10-28T02:01:00.000Z' },
                  stockBajo: { productos: 4, total: 93 },
                  unidadesVendidas: { actual: 6986, anterior: 7426, variacion: -0.0593 },
                  categoriaTop: { categoria: 'Papelería', unidades: 2175, participacion: 0.3113 },
                  porMes: [
                    { mes: '2026-08', entradas: 2390, salidas: 2460 },
                    { mes: '2026-09', entradas: 2411, salidas: 2374 },
                    { mes: '2026-10', entradas: 2374, salidas: 2152 },
                  ],
                  porCategoria: [
                    { categoria: 'Papelería', unidades: 2175 },
                    { categoria: 'Botanas', unidades: 1280 },
                  ],
                  porReponer: [
                    {
                      id_producto: 10,
                      nombre: 'Hojas blancas paquete 500',
                      categoria: 'Papelería',
                      stock_actual: 5,
                      stock_minimo: 10,
                      faltante: 5,
                    },
                  ],
                },
              },
            },
          },
          500: error500,
        },
      },
    },
    '/categorias': {
      get: {
        tags: ['Catálogos'],
        summary: 'Listar categorías',
        description: 'Categorías de producto en orden alfabético, para los filtros de productos y movimientos.',
        operationId: 'listarCategorias',
        responses: {
          200: {
            description: 'Nombres de categoría',
            content: {
              'application/json': {
                schema: { type: 'array', items: { type: 'string' } },
                example: ['Abarrotes', 'Bebidas', 'Botanas', 'Electrónica', 'Ferretería', 'Higiene personal', 'Limpieza', 'Papelería'],
              },
            },
          },
          500: error500,
        },
      },
    },
    '/salud': {
      get: {
        tags: ['Sistema'],
        summary: 'Verificar que la API responde',
        description: 'No consulta la base de datos.',
        operationId: 'salud',
        responses: {
          200: {
            description: 'La API está en línea',
            content: {
              'application/json': {
                schema: { type: 'object', properties: { ok: { type: 'boolean' } } },
                example: { ok: true },
              },
            },
          },
        },
      },
    },
  },
  components: {
    parameters: {
      q: {
        name: 'q',
        in: 'query',
        description: 'Texto a buscar en el nombre del producto (sin distinguir mayúsculas; sí distingue acentos)',
        schema: { type: 'string' },
        example: 'cuaderno',
      },
      categoria: {
        name: 'categoria',
        in: 'query',
        description: 'Categoría exacta, como la devuelve `GET /categorias`',
        schema: { type: 'string' },
        example: 'Papelería',
      },
      page: {
        name: 'page',
        in: 'query',
        description: 'Número de página, desde 1',
        schema: { type: 'integer', minimum: 1, default: 1 },
      },
      limit: {
        name: 'limit',
        in: 'query',
        description: 'Registros por página',
        schema: { type: 'integer', enum: [10, 20, 50, 100], default: 20 },
      },
    },
    schemas: {
      Producto: {
        type: 'object',
        required: ['id_producto', 'nombre', 'categoria', 'stock_actual', 'stock_minimo', 'precio', 'fecha_actualizacion', 'estado_stock'],
        properties: {
          id_producto: { type: 'integer' },
          nombre: { type: 'string' },
          categoria: { type: 'string' },
          stock_actual: { type: 'integer', minimum: 0 },
          stock_minimo: { type: 'integer', minimum: 0 },
          precio: { type: 'number', description: 'Precio en pesos mexicanos' },
          fecha_actualizacion: { type: 'string', format: 'date-time' },
          estado_stock: {
            type: 'string',
            enum: ['agotado', 'bajo', 'ok'],
            description: '`agotado`: stock 0 · `bajo`: por debajo del mínimo · `ok`: en o por encima del mínimo',
          },
        },
      },
      Movimiento: {
        type: 'object',
        required: ['id_movimiento', 'fecha_movimiento', 'tipo_movimiento', 'cantidad', 'observaciones', 'id_producto', 'producto', 'categoria', 'usuario'],
        properties: {
          id_movimiento: { type: 'integer' },
          fecha_movimiento: { type: 'string', format: 'date-time' },
          tipo_movimiento: { type: 'string', enum: ['entrada', 'salida', 'ajuste'] },
          cantidad: {
            type: 'integer',
            description: 'Unidades. Positiva en entradas y salidas; en ajustes, negativa si resta stock.',
          },
          observaciones: { type: ['string', 'null'] },
          id_producto: { type: 'integer' },
          producto: { type: 'string', description: 'Nombre del producto' },
          categoria: { type: 'string' },
          usuario: { type: 'string', description: 'Nombre de quien registró el movimiento (ficticio)' },
        },
      },
      Alerta: {
        type: 'object',
        required: ['id_alerta', 'id_producto', 'producto', 'categoria', 'tipo_alerta', 'stock_detectado', 'fecha_generacion', 'estado', 'fecha_atencion'],
        properties: {
          id_alerta: { type: 'integer' },
          id_producto: { type: 'integer' },
          producto: { type: 'string', description: 'Nombre del producto' },
          categoria: { type: 'string' },
          tipo_alerta: { type: 'string', enum: ['stock_bajo', 'agotado'] },
          stock_detectado: { type: 'integer', description: 'Stock del producto cuando se generó la alerta' },
          fecha_generacion: { type: 'string', format: 'date-time' },
          estado: { type: 'string', enum: ['pendiente', 'atendida', 'cerrada'] },
          fecha_atencion: { type: ['string', 'null'], format: 'date-time', description: 'null mientras está pendiente' },
        },
      },
      ProductoPorReponer: {
        type: 'object',
        required: ['id_producto', 'nombre', 'categoria', 'stock_actual', 'stock_minimo', 'faltante'],
        properties: {
          id_producto: { type: 'integer' },
          nombre: { type: 'string' },
          categoria: { type: 'string' },
          stock_actual: { type: 'integer' },
          stock_minimo: { type: 'integer' },
          faltante: { type: 'integer', description: 'stock_minimo − stock_actual' },
        },
      },
      Dashboard: {
        type: 'object',
        required: ['meses', 'periodo', 'stockBajo', 'unidadesVendidas', 'categoriaTop', 'porMes', 'porCategoria', 'porReponer'],
        properties: {
          meses: { type: 'integer', enum: [3, 6, 12] },
          periodo: {
            type: 'object',
            properties: {
              inicio: { type: 'string', format: 'date-time', description: 'Primer día del periodo (hora de Mérida)' },
              fin: { type: 'string', format: 'date-time', description: 'Último movimiento registrado' },
            },
          },
          stockBajo: {
            type: 'object',
            description: 'Indicador 1: productos activos por debajo de su stock mínimo',
            properties: {
              productos: { type: 'integer', description: 'Productos bajo el mínimo' },
              total: { type: 'integer', description: 'Productos activos' },
            },
          },
          unidadesVendidas: {
            type: 'object',
            description: 'Indicador 2: unidades vendidas (salidas) en el periodo',
            properties: {
              actual: { type: 'integer' },
              anterior: {
                type: ['integer', 'null'],
                description: 'Mismo número de meses justo antes; null si el historial no los cubre completos',
              },
              variacion: {
                type: ['number', 'null'],
                description: 'Proporción de cambio contra el periodo anterior (−0.059 = −5.9 %); null sin periodo anterior',
              },
            },
          },
          categoriaTop: {
            type: ['object', 'null'],
            description: 'Indicador 3: categoría más vendida; null si no hubo ventas',
            properties: {
              categoria: { type: 'string' },
              unidades: { type: 'integer' },
              participacion: { type: 'number', description: 'Proporción del total vendido (0.31 = 31 %)' },
            },
          },
          porMes: {
            type: 'array',
            description: 'Gráfica de entradas y salidas por mes; el último mes puede estar incompleto',
            items: {
              type: 'object',
              properties: {
                mes: { type: 'string', description: 'Formato YYYY-MM', example: '2026-10' },
                entradas: { type: 'integer' },
                salidas: { type: 'integer' },
              },
            },
          },
          porCategoria: {
            type: 'array',
            description: 'Gráfica de unidades vendidas por categoría, de mayor a menor',
            items: {
              type: 'object',
              properties: { categoria: { type: 'string' }, unidades: { type: 'integer' } },
            },
          },
          porReponer: {
            type: 'array',
            description: 'Productos bajo su mínimo, del mayor faltante al menor',
            items: { $ref: '#/components/schemas/ProductoPorReponer' },
          },
        },
      },
      PaginaProductos: paginaDe('Producto'),
      PaginaMovimientos: paginaDe('Movimiento'),
      PaginaAlertas: paginaDe('Alerta'),
      Error: {
        type: 'object',
        required: ['error'],
        properties: { error: { type: 'string', description: 'Mensaje en español' } },
      },
    },
  },
};
