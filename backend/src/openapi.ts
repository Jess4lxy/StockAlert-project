// Especificación OpenAPI 3.1 de la API de StockAlert. Se sirve en /api/openapi.json
// y la interfaz de Swagger en /api/docs (ver routes/docs.ts). Al agregar o cambiar
// un endpoint, actualizar aquí sus parámetros y su respuesta.

const ref = (nombre: string) => ({ $ref: `#/components/schemas/${nombre}` });
const respuesta = (nombre: string) => ({ $ref: `#/components/responses/${nombre}` });
const parametro = (nombre: string) => ({ $ref: `#/components/parameters/${nombre}` });

const errorRespuesta = (ejemplo: string, descripcion = 'Parámetro con un valor no permitido') => ({
  description: descripcion,
  content: {
    'application/json': {
      schema: { $ref: '#/components/schemas/Error' },
      example: { error: ejemplo },
    },
  },
});

// Un error con varios mensajes posibles (cada uno aparece como ejemplo en Swagger)
const erroresRespuesta = (descripcion: string, mensajes: string[]) => ({
  description: descripcion,
  content: {
    'application/json': {
      schema: { $ref: '#/components/schemas/Error' },
      examples: Object.fromEntries(mensajes.map((m, i) => [`e${i + 1}`, { summary: m, value: { error: m } }])),
    },
  },
});

// 400 de un cuerpo JSON: los mensajes propios del endpoint más los comunes a todos
const errorCuerpo = (...mensajes: string[]) =>
  erroresRespuesta('El cuerpo no es válido (el mensaje indica el campo)', [
    ...mensajes,
    'Envía un objeto JSON con Content-Type: application/json',
    'El cuerpo de la petición no es JSON válido',
  ]);

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

const json = (descripcion: string, schema: object, example: unknown) => ({
  description: descripcion,
  content: { 'application/json': { schema, example } },
});

const cuerpoJson = (schema: string, example: unknown) => ({
  required: true,
  content: { 'application/json': { schema: ref(schema), example } },
});

const cuerpoJsonVarios = (schema: string, examples: Record<string, { summary: string; value: unknown }>) => ({
  required: true,
  content: { 'application/json': { schema: ref(schema), examples } },
});

// Mismo texto que noEncontrado() en errores.ts: "Producto no encontrado", "Solicitud no encontrada"
const FEMENINOS = new Set(['Empresa', 'Alerta', 'Solicitud']);
const noEncontradoRespuesta = (que: string, descripcion = `${que} inexistente o de otra empresa`) =>
  errorRespuesta(`${que} no ${FEMENINOS.has(que) ? 'encontrada' : 'encontrado'}`, descripcion);

const alcanceEmpresa = 'Solo ve datos de la empresa del usuario de la sesión.';

// ---- Datos de ejemplo (empresa demo, ficticios) ----

const EMPRESA_DEMO = { id_empresa: 1, nombre: 'Tienda Demo StockAlert' };

const ejemploSesionAdmin = {
  id_usuario: 1,
  nombre: 'Mariana Canché Poot',
  correo: 'mariana.canche@stockalert.test',
  rol: 'admin',
  empresa: EMPRESA_DEMO,
};

const ejemploSesionPlataforma = {
  id_usuario: 9,
  nombre: 'Administrador Uno',
  correo: 'admin1@stockalert.test',
  rol: 'plataforma',
  empresa: null,
};

// Token de acceso de ejemplo: { fam: <familia de la sesión>, iat, exp (15 min después), sub: "1" }
const ejemploDuenoNuevo = {
  id_usuario: 12,
  nombre: 'Guadalupe Dzib Chi',
  correo: 'guadalupe.dzib@stockalert.test',
  rol: 'admin',
  empresa: { id_empresa: 4, nombre: 'Abarrotes Doña Lupita' },
};

const ejemploToken =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJmYW0iOiIzZjZjMmE5ZS04YjFkLTRlNTctOWEwYy01ZDJmN2I4ZTFjNDQiLCJpYXQiOjE3OTU0MDAwMDAsImV4cCI6MTc5NTQwMDkwMCwic3ViIjoiMSJ9.firma-de-ejemplo';

// Refresh token de ejemplo (32 bytes aleatorios en base64url)
const ejemploRefresh = 'Zq7Jt0f3mXc9WbR2kLp8sNv4yHa6dUe1iZo5gTj0xCw';

const EXPIRA_ACCESO = 15 * 60; // segundos (config.jwt.expiraSegundos)
const EXPIRA_REFRESH = 30 * 24 * 60 * 60; // segundos (DIAS_REFRESH en auth/refresh.ts)

// Respuesta de sesión: web recibe el refresh token en la cookie; móvil, en el JSON
const sesionWeb = (usuario: unknown) => ({ token: ejemploToken, expira_en: EXPIRA_ACCESO, usuario });
const sesionMovil = (usuario: unknown) => ({
  ...sesionWeb(usuario),
  refresh_token: ejemploRefresh,
  refresh_expira_en: EXPIRA_REFRESH,
});

// 200/201 de login, registro y refresh, con el encabezado Set-Cookie (solo cliente web)
const sesionRespuesta = (descripcion: string, examples: Record<string, { summary: string; value: unknown }>) => ({
  description: descripcion,
  headers: { 'Set-Cookie': { $ref: '#/components/headers/SetCookieRefresh' } },
  content: { 'application/json': { schema: ref('SesionRespuesta'), examples } },
});

const ejemploEmpresa = {
  id_empresa: 1,
  nombre: 'Tienda Demo StockAlert',
  fecha_registro: '2025-10-01T15:00:00.000Z',
  estado: true,
  usuarios: 8,
  productos: 93,
};

const ejemploUsuario = {
  id_usuario: 3,
  nombre: 'Daniela Pech Ek',
  correo: 'daniela.pech@stockalert.test',
  rol: 'almacen',
  estado: true,
  fecha_registro: '2025-10-03T15:00:00.000Z',
  id_empresa: 1,
  empresa: 'Tienda Demo StockAlert',
};

const ejemploProducto = {
  id_producto: 10,
  nombre: 'Hojas blancas paquete 500',
  descripcion: 'Papel bond tamaño carta, 75 g/m²',
  categoria: 'Papelería',
  stock_actual: 5,
  stock_minimo: 10,
  precio: 77.5,
  fecha_actualizacion: '2026-10-26T22:23:00.000Z',
  estado: true,
  estado_stock: 'bajo',
};

const ejemploAlertaGenerada = {
  id_alerta: 209,
  id_producto: 10,
  tipo_alerta: 'stock_bajo',
  stock_detectado: 5,
  fecha_generacion: '2026-11-22T17:40:12.000Z',
  estado: 'pendiente',
};

const ejemploMovimiento = {
  id_movimiento: 9995,
  fecha_movimiento: '2026-10-28T00:04:00.000Z',
  tipo_movimiento: 'salida',
  cantidad: 6,
  observaciones: null,
  id_producto: 1,
  producto: 'Cuaderno profesional 100 hojas',
  categoria: 'Papelería',
  id_usuario: 8,
  usuario: 'Miguel Balam Can',
};

const ejemploSolicitud = {
  id_solicitud: 31,
  id_producto: 10,
  producto: 'Hojas blancas paquete 500',
  categoria: 'Papelería',
  stock_actual: 5,
  stock_minimo: 10,
  id_alerta: 209,
  tipo_alerta: 'stock_bajo',
  cantidad_sugerida: 15,
  estado: 'pendiente',
  notas: null,
  fecha_creacion: '2026-11-22T17:40:15.000Z',
  fecha_actualizacion: '2026-11-22T17:40:15.000Z',
};

const ejemploAlerta = {
  id_alerta: 208,
  id_producto: 43,
  producto: 'Refresco de cola 600 ml',
  categoria: 'Bebidas',
  tipo_alerta: 'stock_bajo',
  stock_detectado: 19,
  fecha_generacion: '2026-10-27T23:06:00.000Z',
  estado: 'pendiente',
  fecha_atencion: null,
};

export const openapi = {
  openapi: '3.1.0',
  info: {
    title: 'StockAlert API',
    version: '2.1.0',
    description: [
      'API REST de **StockAlert**, inventario inteligente para pequeños negocios.',
      '',
      '**Sesión**',
      '- Casi todos los endpoints exigen sesión: inicia sesión con `POST /auth/login` (o registra tu negocio con `POST /auth/registro`) y envía el token de acceso en el encabezado `Authorization: Bearer <token>`. En Swagger, usa el botón **Authorize**.',
      '- El **token de acceso** (JWT) dura **15 minutos** (`expira_en: 900`). Lo renueva el **refresh token**, que dura **30 días** y se cambia por uno nuevo en cada renovación (rotación).',
      '- En cada petición se revisa que el usuario y su empresa sigan activos y que su sesión siga abierta, así que desactivar a alguien, cambiarle el rol o cerrar su sesión aplica de inmediato.',
      '- Cada inicio de sesión abre una sesión para ese dispositivo. `POST /auth/logout` la cierra; cambiar la contraseña propia (`PATCH /auth/contrasena`) cierra las de los demás dispositivos; asignarle una contraseña a un usuario o desactivarlo (`PATCH /usuarios/{id}`) cierra las suyas.',
      '- Son públicos (sin token de acceso) `GET /salud`, `POST /auth/login`, `POST /auth/registro`, `POST /auth/refresh`, `POST /auth/logout`, `GET /docs` y `GET /openapi.json`. `POST /integraciones/n8n/solicitudes` usa su propio token (`X-StockAlert-Token`).',
      '',
      '**Flujo del cliente**',
      '- **Web** (`cliente: "web"`, por omisión): el refresh token llega en la cookie httpOnly `stockalert_refresh` (`Path=/api/auth`, `SameSite=Strict`, `Secure` en producción), que JavaScript no puede leer. Las peticiones a `/auth/*` deben usar `fetch(url, { credentials: "include" })` para que el navegador envíe y guarde la cookie (en desarrollo, el frontend y la API están en puertos distintos).',
      '- **Móvil** (`cliente: "movil"`): el refresh token llega en el JSON (`refresh_token`, `refresh_expira_en`); la app lo guarda en su almacenamiento seguro y lo envía en el cuerpo de `/auth/refresh` y `/auth/logout`.',
      '- Si cualquier endpoint que no sea de `/auth` responde **401**, llama **una vez** a `POST /auth/refresh` y repite la petición con el token nuevo. Si el refresh también responde 401, la sesión terminó: manda al usuario a iniciar sesión. Si responde **409**, otra pestaña acaba de renovar la sesión: reintenta el refresh una vez.',
      '',
      '**Roles**',
      '- `plataforma`: administradores de StockAlert. No pertenecen a ninguna empresa: crean y desactivan empresas y usuarios, pero **no tienen inventario** (los endpoints de inventario les responden 403).',
      '- `admin`: dueño de una empresa. Administra los usuarios de su empresa, da de alta y edita productos, registra movimientos, atiende alertas y da seguimiento a las solicitudes de reposición.',
      '- `almacen`: personal de almacén. Consulta el inventario, registra movimientos, atiende alertas y da seguimiento a las solicitudes de reposición.',
      '',
      '**Varias empresas**',
      '- Cada empresa ve solo sus propios productos, movimientos, alertas, solicitudes de reposición, categorías, indicadores y usuarios. Un id de otra empresa responde 404, como si no existiera.',
      '',
      '**Inventario**',
      '- El stock **solo cambia con movimientos** (`POST /movimientos`: entrada, salida o ajuste); no se edita en el producto. Cada movimiento actualiza el stock y genera o atiende alertas en la misma transacción.',
      '- Al generarse una alerta se avisa a un flujo de n8n (ver la sección **Webhooks**: `alertaGenerada`). El flujo avisa por correo a los administradores y registra una **solicitud de reposición** con `POST /integraciones/n8n/solicitudes`; el equipo le da seguimiento en `/solicitudes`.',
      '- Nada se borra: productos, usuarios y empresas se desactivan (`estado: false`) y los movimientos se corrigen con un ajuste.',
      '',
      '**Formato**',
      '- La empresa de demostración (*Tienda Demo StockAlert*) tiene datos **ficticios**: un año simulado con 93 productos, 10,000 movimientos y 208 alertas.',
      '- Búsqueda, filtros y paginación se resuelven en el servidor: cada respuesta trae solo la página pedida.',
      '- Las fechas van en ISO 8601 (UTC). El negocio está en Mérida (UTC−6).',
      '- Paginación: `limit` acepta 10, 20, 50 o 100 (otro valor usa 20) y `page` empieza en 1 (un valor inválido usa 1).',
      '- Los errores siempre tienen la forma `{ "error": "mensaje en español" }`.',
      '- Los cuerpos van en JSON (`Content-Type: application/json`, máximo 100 kB). Los textos se guardan sin espacios al inicio ni al final y los correos en minúsculas.',
    ].join('\n'),
  },
  servers: [
    { url: '/api', description: 'Mismo servidor que esta documentación' },
    { url: 'https://stockalert-beta.vercel.app/api', description: 'Producción (Vercel)' },
    { url: 'http://localhost:3000/api', description: 'Desarrollo local (npm run dev)' },
  ],
  security: [{ bearerAuth: [] }],
  tags: [
    { name: 'Autenticación', description: 'Inicio, renovación y cierre de sesión, registro de negocios y cuenta propia' },
    { name: 'Empresas', description: 'Negocios que usan StockAlert (solo rol plataforma)' },
    { name: 'Usuarios', description: 'Cuentas de acceso (roles plataforma y admin)' },
    { name: 'Productos', description: 'Catálogo con stock actual contra mínimo' },
    { name: 'Movimientos', description: 'Entradas, salidas y ajustes de inventario' },
    { name: 'Alertas', description: 'Alertas de stock bajo o agotado' },
    { name: 'Solicitudes de reposición', description: 'Pedidos sugeridos que registra n8n por cada alerta; el equipo les da seguimiento' },
    { name: 'Dashboard', description: 'Indicadores y datos de las gráficas' },
    { name: 'Catálogos', description: 'Listas para los filtros' },
    { name: 'Integraciones', description: 'Endpoint y aviso para servicios externos (n8n), no para personas' },
    { name: 'Sistema', description: 'Estado del servicio y documentación' },
  ],
  paths: {
    // ------------------------------------------------------------ Autenticación
    '/auth/login': {
      post: {
        tags: ['Autenticación'],
        summary: 'Iniciar sesión',
        description:
          'Público. Recibe correo y contraseña, abre una sesión para este dispositivo y devuelve el token de acceso (JWT, válido 15 minutos), ' +
          'su duración en segundos (`expira_en`) y los datos del usuario.\n' +
          '- `cliente: "web"` (por omisión): el refresh token (30 días) se entrega en la cookie httpOnly `stockalert_refresh` (encabezado `Set-Cookie`).\n' +
          '- `cliente: "movil"`: el refresh token viene en el JSON (`refresh_token`, `refresh_expira_en`) y no se envía cookie.\n\n' +
          'El correo no distingue mayúsculas. Si el correo no existe o la contraseña no coincide, la respuesta es la misma (401) ' +
          'y tarda lo mismo, para no revelar qué correos están registrados.',
        operationId: 'iniciarSesion',
        security: [],
        requestBody: cuerpoJsonVarios('LoginEntrada', {
          web: { summary: 'Navegador (refresh token en cookie)', value: { correo: 'mariana.canche@stockalert.test', contrasena: 'clave-segura-2026' } },
          movil: {
            summary: 'App móvil (refresh token en el JSON)',
            value: { correo: 'mariana.canche@stockalert.test', contrasena: 'clave-segura-2026', cliente: 'movil' },
          },
        }),
        responses: {
          200: sesionRespuesta('Sesión iniciada', {
            admin: { summary: 'Web: dueño de la empresa demo', value: sesionWeb(ejemploSesionAdmin) },
            plataforma: { summary: 'Web: administrador de la plataforma', value: sesionWeb(ejemploSesionPlataforma) },
            movil: { summary: 'Móvil: incluye el refresh token', value: sesionMovil(ejemploSesionAdmin) },
          }),
          400: errorCuerpo(
            'correo es obligatorio',
            'correo no es un correo válido',
            'contrasena es obligatoria',
            'cliente debe ser uno de: web, movil',
          ),
          401: errorRespuesta('Correo o contraseña incorrectos', 'Correo o contraseña incorrectos'),
          403: errorRespuesta('La cuenta o su empresa están desactivadas', 'Credenciales correctas, pero la cuenta o su empresa están desactivadas'),
          500: error500,
        },
      },
    },
    '/auth/registro': {
      post: {
        tags: ['Autenticación'],
        summary: 'Registrar un negocio',
        description:
          'Público. Crea en una sola operación la empresa y su usuario administrador (rol `admin`, el dueño) y devuelve la sesión ya iniciada, ' +
          'igual que `POST /auth/login` (incluido `cliente`: con `web` el refresh token va en la cookie; con `movil`, en el JSON). ' +
          'Después, el dueño da de alta a su personal con `POST /usuarios`.',
        operationId: 'registrarNegocio',
        security: [],
        requestBody: cuerpoJson('RegistroEntrada', {
          empresa: 'Abarrotes Doña Lupita',
          nombre: 'Guadalupe Dzib Chi',
          correo: 'guadalupe.dzib@stockalert.test',
          contrasena: 'clave-segura-2026',
        }),
        responses: {
          201: sesionRespuesta('Empresa y administrador creados; sesión iniciada', {
            web: { summary: 'Web (refresh token en la cookie)', value: sesionWeb(ejemploDuenoNuevo) },
            movil: { summary: 'Móvil (refresh token en el JSON)', value: sesionMovil(ejemploDuenoNuevo) },
          }),
          400: errorCuerpo(
            'empresa es obligatorio',
            'empresa debe tener al menos 2 caracteres',
            'nombre admite como máximo 100 caracteres',
            'correo no es un correo válido',
            'contrasena debe tener al menos 8 caracteres',
            'cliente debe ser uno de: web, movil',
          ),
          409: errorRespuesta('Ya existe una cuenta con ese correo', 'El correo ya está registrado'),
          500: error500,
        },
      },
    },
    '/auth/refresh': {
      post: {
        tags: ['Autenticación'],
        summary: 'Renovar el token de acceso',
        description:
          'Público (no lleva `Authorization`). Cambia el refresh token por un token de acceso nuevo (15 minutos) y un refresh token nuevo (30 días): ' +
          'el usado deja de servir (**rotación**). El refresh token se lee del cuerpo (`refresh_token`, app móvil) o, si no viene, ' +
          'de la cookie `stockalert_refresh` (web; usa `credentials: "include"`).\n\n' +
          'El refresh token nuevo se entrega igual que al iniciar sesión, según el tipo de cliente con que se abrió la sesión: ' +
          'web en la cookie (`Set-Cookie`), móvil en el JSON.\n\n' +
          'Seguridad de la rotación:\n' +
          '- Si llega un token que ya se usó **hace menos de 30 segundos**, casi seguro son dos pestañas renovando a la vez: responde **409** sin revocar nada. ' +
          'El cliente reintenta una vez (en web, la cookie ya trae el token nuevo).\n' +
          '- Si llega un token ya reemplazado **más tarde**, alguien guardó una copia (posible robo): se cierra la sesión completa de ese dispositivo ' +
          'y responde 401 (*Por seguridad se cerró la sesión…*).\n' +
          '- Si la cuenta o su empresa se desactivaron, se cierra la sesión, se borra la cookie y responde 401.',
        operationId: 'renovarSesion',
        security: [{ cookieRefresh: [] }, {}],
        requestBody: {
          required: false,
          description: 'Solo la app móvil. En web se omite: el refresh token viaja en la cookie.',
          content: { 'application/json': { schema: ref('RefreshEntrada'), example: { refresh_token: ejemploRefresh } } },
        },
        responses: {
          200: sesionRespuesta('Sesión renovada: token de acceso nuevo y refresh token nuevo', {
            web: { summary: 'Web (refresh token nuevo en la cookie)', value: sesionWeb(ejemploSesionAdmin) },
            movil: { summary: 'Móvil (refresh token nuevo en el JSON)', value: sesionMovil(ejemploSesionAdmin) },
          }),
          401: erroresRespuesta('Falta el refresh token, no existe, ya expiró, la sesión se cerró o la cuenta se desactivó: hay que iniciar sesión de nuevo', [
            'Falta el refresh token. Inicia sesión de nuevo.',
            'La sesión no es válida o ya expiró. Inicia sesión de nuevo.',
            'Por seguridad se cerró la sesión: se usó un token de renovación que ya había sido reemplazado. Inicia sesión de nuevo.',
            'La cuenta o su empresa están desactivadas',
          ]),
          403: errorRespuesta(
            'La cuenta o su empresa están desactivadas',
            'Caso poco común: la cuenta o su empresa se desactivaron justo entre la renovación y la respuesta',
          ),
          400: errorRespuesta('El cuerpo de la petición no es JSON válido', 'Se envió un cuerpo que no es JSON válido'),
          409: errorRespuesta(
            'La sesión se acaba de renovar en otra petición. Vuelve a intentarlo.',
            'El mismo refresh token se renovó hace menos de 30 segundos (por ejemplo, dos pestañas a la vez). Reintenta una vez.',
          ),
          500: error500,
        },
      },
    },
    '/auth/logout': {
      post: {
        tags: ['Autenticación'],
        summary: 'Cerrar sesión',
        description:
          'Público (no lleva `Authorization`). Cierra la sesión de este dispositivo: revoca el refresh token (cuerpo `refresh_token` en móvil, ' +
          'o la cookie en web) y todos los de su misma sesión, y borra la cookie. El token de acceso de esa sesión deja de funcionar de inmediato.\n\n' +
          'Responde 204 aunque no llegue token o ya no fuera válido: el resultado es el mismo.',
        operationId: 'cerrarSesion',
        security: [{ cookieRefresh: [] }, {}],
        requestBody: {
          required: false,
          description: 'Solo la app móvil. En web se omite: el refresh token viaja en la cookie.',
          content: { 'application/json': { schema: ref('RefreshEntrada'), example: { refresh_token: ejemploRefresh } } },
        },
        responses: {
          204: {
            description: 'Sesión cerrada (sin cuerpo). La cookie se borra.',
            headers: {
              'Set-Cookie': {
                description: 'Borra la cookie del refresh token',
                schema: { type: 'string' },
                example: 'stockalert_refresh=; Path=/api/auth; Expires=Thu, 01 Jan 1970 00:00:00 GMT; HttpOnly; Secure; SameSite=Strict',
              },
            },
          },
          400: errorRespuesta('El cuerpo de la petición no es JSON válido', 'Se envió un cuerpo que no es JSON válido'),
          500: error500,
        },
      },
    },
    '/auth/yo': {
      get: {
        tags: ['Autenticación'],
        summary: 'Usuario de la sesión',
        description: 'Cualquier rol. Devuelve los datos del usuario del token (los mismos que `usuario` en el inicio de sesión), leídos de nuevo de la base.',
        operationId: 'usuarioActual',
        responses: {
          200: {
            description: 'Usuario de la sesión',
            content: {
              'application/json': {
                schema: ref('UsuarioSesion'),
                examples: {
                  admin: { summary: 'Usuario de una empresa', value: ejemploSesionAdmin },
                  plataforma: { summary: 'Administrador de la plataforma (sin empresa)', value: ejemploSesionPlataforma },
                },
              },
            },
          },
          401: respuesta('NoAutenticado'),
          500: error500,
        },
      },
    },
    '/auth/contrasena': {
      patch: {
        tags: ['Autenticación'],
        summary: 'Cambiar mi contraseña',
        description:
          'Cualquier rol. Cambia la contraseña del usuario de la sesión; exige la actual. Cierra sus sesiones en **los demás dispositivos** ' +
          '(sus refresh tokens dejan de servir y sus tokens de acceso fallan de inmediato); la sesión de este dispositivo sigue abierta.',
        operationId: 'cambiarContrasena',
        requestBody: cuerpoJson('CambioContrasenaEntrada', { actual: 'clave-segura-2026', nueva: 'otra-clave-segura-2026' }),
        responses: {
          204: { description: 'Contraseña cambiada (sin cuerpo)' },
          400: errorCuerpo(
            'La contraseña actual no es correcta',
            'actual es obligatoria',
            'nueva es obligatoria',
            'nueva debe tener al menos 8 caracteres',
            'nueva admite como máximo 128 caracteres',
          ),
          401: respuesta('NoAutenticado'),
          500: error500,
        },
      },
    },

    // ------------------------------------------------------------ Empresas
    '/empresas': {
      get: {
        tags: ['Empresas'],
        summary: 'Listar empresas',
        description:
          'Solo rol `plataforma`. Todas las empresas en orden alfabético, con el número de usuarios y de productos activos de cada una.',
        operationId: 'listarEmpresas',
        parameters: [
          {
            name: 'q',
            in: 'query',
            description: 'Texto a buscar en el nombre de la empresa (sin distinguir mayúsculas)',
            schema: { type: 'string' },
            example: 'demo',
          },
          {
            name: 'estado',
            in: 'query',
            description: '`activa` o `inactiva`; sin este parámetro devuelve ambas',
            schema: { type: 'string', enum: ['activa', 'inactiva'] },
          },
          parametro('page'),
          parametro('limit'),
        ],
        responses: {
          200: json('Página de empresas', ref('PaginaEmpresas'), { data: [ejemploEmpresa], page: 1, limit: 20, total: 3, totalPages: 1 }),
          400: errorRespuesta('estado debe ser uno de: activa, inactiva'),
          401: respuesta('NoAutenticado'),
          403: respuesta('SinPermiso'),
          500: error500,
        },
      },
      post: {
        tags: ['Empresas'],
        summary: 'Crear una empresa',
        description:
          'Solo rol `plataforma`. Crea la empresa y, si se envía `admin`, también la cuenta de su dueño (rol `admin`) en la misma transacción: ' +
          'si el correo ya existe no se crea ninguna de las dos.',
        operationId: 'crearEmpresa',
        requestBody: cuerpoJsonVarios('EmpresaNueva', {
          conAdmin: {
            summary: 'Empresa con su administrador',
            value: {
              nombre: 'Papelería El Estudiante',
              admin: { nombre: 'Carlos May Pool', correo: 'carlos.may@stockalert.test', contrasena: 'clave-segura-2026' },
            },
          },
          sinAdmin: { summary: 'Solo la empresa', value: { nombre: 'Ferretería La Huachita' } },
        }),
        responses: {
          201: json('Empresa creada', ref('Empresa'), {
            id_empresa: 5,
            nombre: 'Papelería El Estudiante',
            fecha_registro: '2026-11-22T17:30:00.000Z',
            estado: true,
            usuarios: 1,
            productos: 0,
          }),
          400: errorCuerpo(
            'nombre es obligatorio',
            'nombre debe tener al menos 2 caracteres',
            'admin debe ser un objeto',
            'correo no es un correo válido',
            'contrasena es obligatoria',
          ),
          401: respuesta('NoAutenticado'),
          403: respuesta('SinPermiso'),
          409: errorRespuesta('Ya existe una cuenta con ese correo', 'El correo del administrador ya está registrado'),
          500: error500,
        },
      },
    },
    '/empresas/{id}': {
      parameters: [parametro('id')],
      get: {
        tags: ['Empresas'],
        summary: 'Obtener una empresa',
        description: 'Solo rol `plataforma`. Incluye empresas desactivadas.',
        operationId: 'obtenerEmpresa',
        responses: {
          200: json('Empresa', ref('Empresa'), ejemploEmpresa),
          401: respuesta('NoAutenticado'),
          403: respuesta('SinPermiso'),
          404: respuesta('EmpresaNoEncontrada'),
          500: error500,
        },
      },
      patch: {
        tags: ['Empresas'],
        summary: 'Editar o desactivar una empresa',
        description:
          'Solo rol `plataforma`. Cambia el nombre o el estado. Con `estado: false` la empresa queda desactivada: sus usuarios ya no pueden ' +
          'iniciar sesión y los tokens que tenían dejan de funcionar de inmediato. Sus datos se conservan; con `estado: true` se reactiva.',
        operationId: 'editarEmpresa',
        requestBody: cuerpoJsonVarios('EmpresaCambios', {
          renombrar: { summary: 'Cambiar el nombre', value: { nombre: 'Tienda Demo StockAlert Centro' } },
          desactivar: { summary: 'Desactivar', value: { estado: false } },
        }),
        responses: {
          200: json('Empresa actualizada', ref('Empresa'), { ...ejemploEmpresa, estado: false }),
          400: errorCuerpo('Envía al menos un campo: nombre o estado', 'nombre debe tener al menos 2 caracteres', 'estado debe ser true o false'),
          401: respuesta('NoAutenticado'),
          403: respuesta('SinPermiso'),
          404: respuesta('EmpresaNoEncontrada'),
          500: error500,
        },
      },
    },

    // ------------------------------------------------------------ Usuarios
    '/usuarios': {
      get: {
        tags: ['Usuarios'],
        summary: 'Listar usuarios',
        description:
          'Roles `plataforma` y `admin`, en orden alfabético.\n' +
          '- `plataforma`: ve los usuarios de todas las empresas (y a los demás administradores de la plataforma); puede limitar a una empresa con `id_empresa`.\n' +
          '- `admin`: solo ve los de su empresa; `id_empresa` se ignora.',
        operationId: 'listarUsuarios',
        parameters: [
          {
            name: 'q',
            in: 'query',
            description: 'Texto a buscar en el nombre o el correo (sin distinguir mayúsculas)',
            schema: { type: 'string' },
            example: 'pech',
          },
          {
            name: 'rol',
            in: 'query',
            description: 'Rol del usuario',
            schema: { type: 'string', enum: ['plataforma', 'admin', 'almacen'] },
          },
          {
            name: 'estado',
            in: 'query',
            description: '`activo` o `inactivo`; sin este parámetro devuelve ambos',
            schema: { type: 'string', enum: ['activo', 'inactivo'] },
          },
          {
            name: 'id_empresa',
            in: 'query',
            description: 'Solo para el rol `plataforma`: limita la lista a una empresa. Para un `admin` se ignora (aunque se valida el formato).',
            schema: { type: 'integer', minimum: 1 },
            example: 1,
          },
          parametro('page'),
          parametro('limit'),
        ],
        responses: {
          200: json('Página de usuarios', ref('PaginaUsuarios'), { data: [ejemploUsuario], page: 1, limit: 20, total: 8, totalPages: 1 }),
          400: erroresRespuesta('Parámetro con un valor no permitido', [
            'rol debe ser uno de: plataforma, admin, almacen',
            'estado debe ser uno de: activo, inactivo',
            'id_empresa debe ser un número entero positivo',
          ]),
          401: respuesta('NoAutenticado'),
          403: respuesta('SinPermiso'),
          500: error500,
        },
      },
      post: {
        tags: ['Usuarios'],
        summary: 'Crear un usuario',
        description:
          'Roles `plataforma` y `admin`.\n' +
          '- `admin`: crea usuarios de su propia empresa con rol `admin` o `almacen`; `id_empresa` se ignora.\n' +
          '- `plataforma`: puede crear cualquier rol. Para `admin` o `almacen` debe indicar `id_empresa` (una empresa activa); ' +
          'para `plataforma` no se usa `id_empresa` (esos usuarios no tienen empresa).',
        operationId: 'crearUsuario',
        requestBody: cuerpoJsonVarios('UsuarioNuevo', {
          admin: {
            summary: 'Un admin da de alta a su personal',
            value: { nombre: 'Luis Tun Cauich', correo: 'luis.tun@stockalert.test', contrasena: 'clave-segura-2026', rol: 'almacen' },
          },
          plataforma: {
            summary: 'La plataforma crea el dueño de una empresa',
            value: {
              nombre: 'Carlos May Pool',
              correo: 'carlos.may@stockalert.test',
              contrasena: 'clave-segura-2026',
              rol: 'admin',
              id_empresa: 5,
            },
          },
        }),
        responses: {
          201: json('Usuario creado', ref('Usuario'), {
            ...ejemploUsuario,
            id_usuario: 13,
            nombre: 'Luis Tun Cauich',
            correo: 'luis.tun@stockalert.test',
            fecha_registro: '2026-11-22T17:35:00.000Z',
          }),
          400: errorCuerpo(
            'nombre es obligatorio',
            'correo no es un correo válido',
            'contrasena debe tener al menos 8 caracteres',
            'rol debe ser uno de: admin, almacen',
            'id_empresa es obligatorio',
            'La empresa no existe o está desactivada',
          ),
          401: respuesta('NoAutenticado'),
          403: respuesta('SinPermiso'),
          409: errorRespuesta('Ya existe una cuenta con ese correo', 'El correo ya está registrado'),
          500: error500,
        },
      },
    },
    '/usuarios/{id}': {
      parameters: [parametro('id')],
      get: {
        tags: ['Usuarios'],
        summary: 'Obtener un usuario',
        description:
          'Roles `plataforma` (cualquier usuario) y `admin` (solo de su empresa; el de otra empresa responde 404). Incluye usuarios desactivados.',
        operationId: 'obtenerUsuario',
        responses: {
          200: json('Usuario', ref('Usuario'), ejemploUsuario),
          401: respuesta('NoAutenticado'),
          403: respuesta('SinPermiso'),
          404: respuesta('UsuarioNoEncontrado'),
          500: error500,
        },
      },
      patch: {
        tags: ['Usuarios'],
        summary: 'Editar o desactivar un usuario',
        description:
          'Roles `plataforma` (cualquier usuario) y `admin` (solo de su empresa). Se envían solo los campos a cambiar.\n' +
          '- `contrasena` asigna una nueva contraseña sin pedir la anterior (para que el usuario cambie la suya existe `PATCH /auth/contrasena`).\n' +
          '- `rol` solo cambia entre `admin` y `almacen`: el rol `plataforma` no se asigna ni se quita.\n' +
          '- Nadie puede cambiar su propio rol ni desactivarse a sí mismo.\n' +
          '- Con `estado: false` el usuario ya no puede iniciar sesión y su token deja de funcionar. No se borra porque sus movimientos lo referencian.\n' +
          '- Con `contrasena` o `estado: false` se cierran las sesiones del usuario en todos sus dispositivos (sus refresh tokens dejan de servir y sus tokens de acceso fallan de inmediato). ' +
          'Si quien hace la petición se cambia su propia contraseña, su sesión actual sigue abierta.',
        operationId: 'editarUsuario',
        requestBody: cuerpoJsonVarios('UsuarioCambios', {
          rol: { summary: 'Cambiar el rol', value: { rol: 'admin' } },
          desactivar: { summary: 'Desactivar', value: { estado: false } },
          contrasena: { summary: 'Asignar una contraseña nueva', value: { contrasena: 'clave-segura-2026' } },
        }),
        responses: {
          200: json('Usuario actualizado', ref('Usuario'), { ...ejemploUsuario, rol: 'admin' }),
          400: errorCuerpo(
            'Envía al menos un campo: nombre, correo, rol, estado o contrasena',
            'No puedes cambiar tu propio rol',
            'No puedes desactivar tu propia cuenta',
            'El rol plataforma no se asigna ni se quita: crea un usuario nuevo',
            'rol debe ser uno de: plataforma, admin, almacen',
            'estado debe ser true o false',
          ),
          401: respuesta('NoAutenticado'),
          403: respuesta('SinPermiso'),
          404: respuesta('UsuarioNoEncontrado'),
          409: errorRespuesta('Ya existe una cuenta con ese correo', 'El correo nuevo ya está registrado'),
          500: error500,
        },
      },
    },

    // ------------------------------------------------------------ Productos
    '/productos': {
      get: {
        tags: ['Productos'],
        summary: 'Listar productos',
        description:
          'Roles `admin` y `almacen`. ' + alcanceEmpresa + ' ' +
          'Ordenados por faltante (stock mínimo − stock actual) de mayor a menor y después por nombre. ' +
          'Así los que más urge reponer salen primero. Por omisión solo devuelve productos activos.',
        operationId: 'listarProductos',
        parameters: [
          parametro('q'),
          {
            name: 'estado',
            in: 'query',
            description:
              'Estado del stock:\n' +
              '- `reponer`: por debajo del mínimo o agotados\n' +
              '- `bajo`: con existencias pero por debajo del mínimo\n' +
              '- `agotado`: stock en 0\n' +
              '- `ok`: con existencias y en o por encima del mínimo',
            schema: { type: 'string', enum: ['reponer', 'bajo', 'agotado', 'ok'] },
          },
          parametro('categoria'),
          {
            name: 'activo',
            in: 'query',
            description: '`true`: solo activos · `false`: solo desactivados · `todos`: ambos',
            schema: { type: 'string', enum: ['true', 'false', 'todos'], default: 'true' },
          },
          parametro('page'),
          parametro('limit'),
        ],
        responses: {
          200: json('Página de productos', ref('PaginaProductos'), { data: [ejemploProducto], page: 1, limit: 20, total: 93, totalPages: 5 }),
          400: erroresRespuesta('Parámetro con un valor no permitido', [
            'estado debe ser uno de: reponer, bajo, agotado, ok',
            'activo debe ser uno de: true, false, todos',
          ]),
          401: respuesta('NoAutenticado'),
          403: respuesta('SinInventario'),
          500: error500,
        },
      },
      post: {
        tags: ['Productos'],
        summary: 'Dar de alta un producto',
        description:
          'Solo rol `admin`; el producto queda en su empresa. Si `stock_inicial` es mayor que 0 se registra además un movimiento de ' +
          'entrada con la observación "Inventario inicial", para que el historial cuadre con el stock. ' +
          'Si el stock inicial queda por debajo del mínimo se genera una alerta (devuelta en `alerta_generada`) y se avisa a n8n.',
        operationId: 'crearProducto',
        requestBody: cuerpoJson('ProductoNuevo', {
          nombre: 'Hojas blancas paquete 500',
          descripcion: 'Papel bond tamaño carta, 75 g/m²',
          categoria: 'Papelería',
          precio: 77.5,
          stock_minimo: 10,
          stock_inicial: 5,
        }),
        responses: {
          201: json('Producto creado', ref('ProductoGuardado'), {
            ...ejemploProducto,
            id_producto: 94,
            fecha_actualizacion: '2026-11-22T17:40:12.000Z',
            alerta_generada: { ...ejemploAlertaGenerada, id_producto: 94 },
          }),
          400: errorCuerpo(
            'nombre es obligatorio',
            'precio es obligatorio',
            'precio debe ser mayor o igual a 0',
            'stock_minimo debe ser un número entero',
            'stock_inicial debe ser mayor o igual a 0',
            'categoria admite como máximo 80 caracteres',
          ),
          401: respuesta('NoAutenticado'),
          403: respuesta('ProhibidoInventario'),
          500: error500,
        },
      },
    },
    '/productos/{id}': {
      parameters: [parametro('id')],
      get: {
        tags: ['Productos'],
        summary: 'Obtener un producto',
        description: 'Roles `admin` y `almacen`. ' + alcanceEmpresa + ' Incluye productos desactivados.',
        operationId: 'obtenerProducto',
        responses: {
          200: json('Producto', ref('Producto'), ejemploProducto),
          401: respuesta('NoAutenticado'),
          403: respuesta('SinInventario'),
          404: respuesta('ProductoNoEncontrado'),
          500: error500,
        },
      },
      patch: {
        tags: ['Productos'],
        summary: 'Editar un producto',
        description:
          'Solo rol `admin`. Se envían solo los campos a cambiar; `descripcion` y `categoria` se borran con `null` o `""`. ' +
          'El **stock no se edita aquí**: enviar `stock_actual` responde 400 (usa un movimiento de ajuste). ' +
          'Si cambia `stock_minimo` se reevalúan las alertas: puede generarse una (devuelta en `alerta_generada` y avisada a n8n) ' +
          'o atenderse las pendientes si el stock ya alcanza el nuevo mínimo. Con `estado: false/true` se desactiva o reactiva.',
        operationId: 'editarProducto',
        requestBody: cuerpoJsonVarios('ProductoCambios', {
          precio: { summary: 'Cambiar precio y mínimo', value: { precio: 82, stock_minimo: 12 } },
          borrarCategoria: { summary: 'Quitar la categoría', value: { categoria: null } },
          reactivar: { summary: 'Reactivar', value: { estado: true } },
        }),
        responses: {
          200: json('Producto actualizado', ref('ProductoGuardado'), {
            ...ejemploProducto,
            precio: 82,
            stock_minimo: 12,
            fecha_actualizacion: '2026-11-22T17:45:00.000Z',
            alerta_generada: null,
          }),
          400: errorCuerpo(
            'El stock no se edita directamente: registra un movimiento de ajuste',
            'Envía al menos un campo: nombre, descripcion, categoria, precio, stock_minimo o estado',
            'precio debe ser un número',
            'stock_minimo debe ser mayor o igual a 0',
            'estado debe ser true o false',
          ),
          401: respuesta('NoAutenticado'),
          403: respuesta('ProhibidoInventario'),
          404: respuesta('ProductoNoEncontrado'),
          500: error500,
        },
      },
      delete: {
        tags: ['Productos'],
        summary: 'Desactivar un producto',
        description:
          'Solo rol `admin`. No borra el producto: lo desactiva (`estado: false`) y conserva su historial de movimientos y alertas. ' +
          'Deja de aparecer en la lista por omisión, en el dashboard y ya no acepta movimientos. Se reactiva con `PATCH` y `estado: true`. ' +
          'Desactivar uno que ya estaba desactivado también responde 204.',
        operationId: 'desactivarProducto',
        responses: {
          204: { description: 'Producto desactivado (sin cuerpo)' },
          401: respuesta('NoAutenticado'),
          403: respuesta('ProhibidoInventario'),
          404: respuesta('ProductoNoEncontrado'),
          500: error500,
        },
      },
    },

    // ------------------------------------------------------------ Movimientos
    '/movimientos': {
      get: {
        tags: ['Movimientos'],
        summary: 'Listar movimientos de inventario',
        description:
          'Roles `admin` y `almacen`. ' + alcanceEmpresa + ' ' +
          'Historial de entradas, salidas y ajustes, del más reciente al más antiguo. ' +
          'La respuesta incluye el encabezado `Server-Timing: db;dur=<ms>` con el tiempo de las consultas en PostgreSQL.',
        operationId: 'listarMovimientos',
        parameters: [
          parametro('q'),
          {
            name: 'tipo',
            in: 'query',
            description: 'Tipo de movimiento',
            schema: { type: 'string', enum: ['entrada', 'salida', 'ajuste'] },
          },
          parametro('categoria'),
          parametro('id_producto'),
          {
            name: 'desde',
            in: 'query',
            description:
              'Fecha inicial (incluida) en ISO 8601. Una fecha sin hora (`2026-10-01`) se toma desde las 00:00 de Mérida; ' +
              'con hora (`2026-10-01T08:00:00-06:00`) se usa tal cual.',
            schema: { type: 'string' },
            example: '2026-10-01',
          },
          {
            name: 'hasta',
            in: 'query',
            description:
              'Fecha final (incluida) en ISO 8601. Una fecha sin hora (`2026-10-31`) incluye todo ese día en hora de Mérida; ' +
              'con hora se usa tal cual.',
            schema: { type: 'string' },
            example: '2026-10-31',
          },
          parametro('page'),
          parametro('limit'),
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
                schema: ref('PaginaMovimientos'),
                example: { data: [ejemploMovimiento], page: 1, limit: 10, total: 706, totalPages: 71 },
              },
            },
          },
          400: erroresRespuesta('Parámetro con un valor no permitido', [
            'tipo debe ser uno de: entrada, salida, ajuste',
            'id_producto debe ser un número entero positivo',
            'desde debe ser una fecha ISO 8601, por ejemplo 2026-10-01',
          ]),
          401: respuesta('NoAutenticado'),
          403: respuesta('SinInventario'),
          500: error500,
        },
      },
      post: {
        tags: ['Movimientos'],
        summary: 'Registrar un movimiento',
        description:
          'Roles `admin` y `almacen`. Es **la única forma de cambiar el stock**. En una sola transacción:\n' +
          '1. Registra el movimiento a nombre del usuario de la sesión.\n' +
          '2. Actualiza el stock: `entrada` suma, `salida` resta y `ajuste` suma o resta según su signo.\n' +
          '3. Evalúa las alertas: si el stock queda por debajo del mínimo y el producto no tenía alertas pendientes, genera una ' +
          '(`agotado` si llegó a 0, si no `stock_bajo`); si llega a 0 y la pendiente era de stock bajo, genera además la de agotado; ' +
          'si el stock alcanza el mínimo, las pendientes pasan a `atendida`.\n\n' +
          'Si se generó una alerta, se avisa a n8n después de confirmar (webhook `alertaGenerada`); si n8n falla, el movimiento no se revierte ' +
          'y `n8n_notificado` es `false`. Los movimientos no se editan ni se borran: un error se corrige con un ajuste.',
        operationId: 'registrarMovimiento',
        requestBody: cuerpoJsonVarios('MovimientoNuevo', {
          salida: { summary: 'Venta (salida)', value: { id_producto: 10, tipo_movimiento: 'salida', cantidad: 3 } },
          entrada: {
            summary: 'Compra al proveedor (entrada)',
            value: { id_producto: 10, tipo_movimiento: 'entrada', cantidad: 24, observaciones: 'Factura A-1532' },
          },
          ajuste: {
            summary: 'Corrección por conteo físico (ajuste negativo)',
            value: { id_producto: 10, tipo_movimiento: 'ajuste', cantidad: -2, observaciones: 'Merma: paquetes mojados' },
          },
        }),
        responses: {
          201: json('Movimiento registrado', ref('MovimientoRegistrado'), {
            movimiento: {
              id_movimiento: 10001,
              fecha_movimiento: '2026-11-22T17:40:12.000Z',
              tipo_movimiento: 'salida',
              cantidad: 3,
              observaciones: null,
              id_producto: 10,
              producto: 'Hojas blancas paquete 500',
              categoria: 'Papelería',
              id_usuario: 3,
              usuario: 'Daniela Pech Ek',
            },
            producto: {
              id_producto: 10,
              nombre: 'Hojas blancas paquete 500',
              categoria: 'Papelería',
              stock_actual: 9,
              stock_minimo: 10,
              estado_stock: 'bajo',
            },
            alerta_generada: { ...ejemploAlertaGenerada, stock_detectado: 9 },
            alertas_atendidas: 0,
            n8n_notificado: true,
          }),
          400: errorCuerpo(
            'id_producto es obligatorio',
            'tipo_movimiento debe ser uno de: entrada, salida, ajuste',
            'cantidad debe ser un número entero',
            'cantidad debe ser mayor o igual a 1',
            'cantidad no puede ser 0',
            'cantidad debe ser menor o igual a 1000000',
            'observaciones admite como máximo 500 caracteres',
          ),
          401: respuesta('NoAutenticado'),
          403: respuesta('ProhibidoInventario'),
          404: respuesta('ProductoNoEncontrado'),
          409: erroresRespuesta('El movimiento no se puede aplicar', [
            'Stock insuficiente: hay 5 y el movimiento resta 6',
            'El producto está desactivado',
          ]),
          500: error500,
        },
      },
    },
    '/movimientos/{id}': {
      parameters: [parametro('id')],
      get: {
        tags: ['Movimientos'],
        summary: 'Obtener un movimiento',
        description: 'Roles `admin` y `almacen`. ' + alcanceEmpresa,
        operationId: 'obtenerMovimiento',
        responses: {
          200: json('Movimiento', ref('Movimiento'), ejemploMovimiento),
          401: respuesta('NoAutenticado'),
          403: respuesta('SinInventario'),
          404: respuesta('MovimientoNoEncontrado'),
          500: error500,
        },
      },
    },

    // ------------------------------------------------------------ Alertas
    '/alertas': {
      get: {
        tags: ['Alertas'],
        summary: 'Listar alertas',
        description: 'Roles `admin` y `almacen`. ' + alcanceEmpresa + ' Alertas de stock, de la más reciente a la más antigua.',
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
          parametro('id_producto'),
          parametro('page'),
          parametro('limit'),
        ],
        responses: {
          200: json('Página de alertas', ref('PaginaAlertas'), { data: [ejemploAlerta], page: 1, limit: 20, total: 208, totalPages: 11 }),
          400: erroresRespuesta('Parámetro con un valor no permitido', [
            'estado debe ser uno de: pendiente, atendida, cerrada',
            'tipo debe ser uno de: stock_bajo, agotado',
            'id_producto debe ser un número entero positivo',
          ]),
          401: respuesta('NoAutenticado'),
          403: respuesta('SinInventario'),
          500: error500,
        },
      },
    },
    '/alertas/resumen': {
      get: {
        tags: ['Alertas'],
        summary: 'Totales de alertas',
        description:
          'Roles `admin` y `almacen`. ' + alcanceEmpresa + ' Número de alertas pendientes y total registrado, para las tarjetas de la pantalla de alertas.',
        operationId: 'resumenAlertas',
        responses: {
          200: json(
            'Totales',
            {
              type: 'object',
              required: ['pendientes', 'total'],
              properties: {
                pendientes: { type: 'integer', description: 'Alertas con estado pendiente' },
                total: { type: 'integer', description: 'Todas las alertas registradas' },
              },
            },
            { pendientes: 4, total: 208 },
          ),
          401: respuesta('NoAutenticado'),
          403: respuesta('SinInventario'),
          500: error500,
        },
      },
    },
    '/alertas/{id}': {
      parameters: [parametro('id')],
      get: {
        tags: ['Alertas'],
        summary: 'Obtener una alerta',
        description: 'Roles `admin` y `almacen`. ' + alcanceEmpresa,
        operationId: 'obtenerAlerta',
        responses: {
          200: json('Alerta', ref('Alerta'), ejemploAlerta),
          401: respuesta('NoAutenticado'),
          403: respuesta('SinInventario'),
          404: respuesta('AlertaNoEncontrada'),
          500: error500,
        },
      },
      patch: {
        tags: ['Alertas'],
        summary: 'Cambiar el estado de una alerta',
        description:
          'Roles `admin` y `almacen`.\n' +
          '- `atendida`: se resolvió (las de un producto repuesto se atienden solas al registrar la entrada).\n' +
          '- `cerrada`: se descarta sin reponer.\n' +
          '- `pendiente`: se reabre.\n\n' +
          '`fecha_atencion` toma la hora actual con `atendida` o `cerrada` y vuelve a `null` con `pendiente`.',
        operationId: 'cambiarEstadoAlerta',
        requestBody: cuerpoJson('AlertaCambio', { estado: 'cerrada' }),
        responses: {
          200: json('Alerta actualizada', ref('Alerta'), { ...ejemploAlerta, estado: 'cerrada', fecha_atencion: '2026-11-22T17:50:00.000Z' }),
          400: errorCuerpo('estado es obligatorio', 'estado debe ser uno de: pendiente, atendida, cerrada'),
          401: respuesta('NoAutenticado'),
          403: respuesta('ProhibidoInventario'),
          404: respuesta('AlertaNoEncontrada'),
          500: error500,
        },
      },
    },

    // ------------------------------------------------------------ Solicitudes de reposición
    '/solicitudes': {
      get: {
        tags: ['Solicitudes de reposición'],
        summary: 'Listar solicitudes de reposición',
        description:
          'Roles `admin` y `almacen`. ' + alcanceEmpresa + ' ' +
          'Solicitudes que registró el flujo de n8n (una por alerta), de la más reciente a la más antigua, con el stock actual del producto.',
        operationId: 'listarSolicitudes',
        parameters: [
          {
            name: 'estado',
            in: 'query',
            description: 'Estado de la solicitud',
            schema: ref('EstadoSolicitud'),
          },
          parametro('id_producto'),
          parametro('page'),
          parametro('limit'),
        ],
        responses: {
          200: json('Página de solicitudes', ref('PaginaSolicitudes'), { data: [ejemploSolicitud], page: 1, limit: 20, total: 1, totalPages: 1 }),
          400: erroresRespuesta('Parámetro con un valor no permitido', [
            'estado debe ser uno de: pendiente, pedida, recibida, cancelada',
            'id_producto debe ser un número entero positivo',
          ]),
          401: respuesta('NoAutenticado'),
          403: respuesta('SinInventario'),
          500: error500,
        },
      },
    },
    '/solicitudes/resumen': {
      get: {
        tags: ['Solicitudes de reposición'],
        summary: 'Totales de solicitudes por estado',
        description: 'Roles `admin` y `almacen`. ' + alcanceEmpresa + ' Número de solicitudes en cada estado (0 si no hay ninguna).',
        operationId: 'resumenSolicitudes',
        responses: {
          200: json('Totales por estado', ref('ResumenSolicitudes'), { pendiente: 3, pedida: 1, recibida: 12, cancelada: 2 }),
          401: respuesta('NoAutenticado'),
          403: respuesta('SinInventario'),
          500: error500,
        },
      },
    },
    '/solicitudes/{id}': {
      parameters: [parametro('id')],
      get: {
        tags: ['Solicitudes de reposición'],
        summary: 'Obtener una solicitud de reposición',
        description: 'Roles `admin` y `almacen`. ' + alcanceEmpresa,
        operationId: 'obtenerSolicitud',
        responses: {
          200: json('Solicitud', ref('Solicitud'), ejemploSolicitud),
          401: respuesta('NoAutenticado'),
          403: respuesta('SinInventario'),
          404: respuesta('SolicitudNoEncontrada'),
          500: error500,
        },
      },
      patch: {
        tags: ['Solicitudes de reposición'],
        summary: 'Dar seguimiento a una solicitud',
        description:
          'Roles `admin` y `almacen`. Se envían solo los campos a cambiar; `fecha_actualizacion` toma la hora actual.\n' +
          '- `estado`: `pendiente` → `pedida` (se hizo el pedido al proveedor) → `recibida`, o `cancelada`. No hay restricción de orden entre estados.\n' +
          '- `cantidad_sugerida`: ajusta la cantidad a pedir.\n' +
          '- `notas`: texto libre; se borra con `null` o `""`.\n\n' +
          'Marcarla como `recibida` **no suma stock**: la mercancía se registra con un movimiento de entrada (`POST /movimientos`).',
        operationId: 'editarSolicitud',
        requestBody: cuerpoJsonVarios('SolicitudCambios', {
          pedida: { summary: 'Se hizo el pedido', value: { estado: 'pedida', notas: 'Pedido 4471 al proveedor Papelera del Sureste' } },
          cantidad: { summary: 'Ajustar la cantidad', value: { cantidad_sugerida: 24 } },
          cancelar: { summary: 'Cancelar', value: { estado: 'cancelada', notas: null } },
        }),
        responses: {
          200: json('Solicitud actualizada', ref('Solicitud'), {
            ...ejemploSolicitud,
            estado: 'pedida',
            notas: 'Pedido 4471 al proveedor Papelera del Sureste',
            fecha_actualizacion: '2026-11-22T18:05:00.000Z',
          }),
          400: errorCuerpo(
            'Envía al menos un campo: estado, cantidad_sugerida o notas',
            'estado debe ser uno de: pendiente, pedida, recibida, cancelada',
            'cantidad_sugerida debe ser un número entero',
            'cantidad_sugerida debe ser mayor o igual a 1',
            'cantidad_sugerida debe ser menor o igual a 1000000',
            'notas admite como máximo 1000 caracteres',
          ),
          401: respuesta('NoAutenticado'),
          403: respuesta('ProhibidoInventario'),
          404: respuesta('SolicitudNoEncontrada'),
          500: error500,
        },
      },
    },

    // ------------------------------------------------------------ Dashboard y catálogos
    '/dashboard': {
      get: {
        tags: ['Dashboard'],
        summary: 'Indicadores del dashboard',
        description:
          'Roles `admin` y `almacen`. ' + alcanceEmpresa + ' ' +
          'Indicadores de los últimos `meses` meses calendario, contando el mes del último movimiento registrado de la empresa ' +
          '(con datos ficticios, "hoy" es el final del historial). Incluye los datos de las dos gráficas y la tabla ' +
          'de productos por reponer. Una empresa sin movimientos recibe `periodo` con `inicio` y `fin` en `null`.',
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
          200: json('Indicadores del periodo', ref('Dashboard'), {
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
          }),
          401: respuesta('NoAutenticado'),
          403: respuesta('SinInventario'),
          500: error500,
        },
      },
    },
    '/categorias': {
      get: {
        tags: ['Catálogos'],
        summary: 'Listar categorías',
        description:
          'Roles `admin` y `almacen`. ' + alcanceEmpresa + ' ' +
          'Categorías distintas de los productos de la empresa (activos o no) en orden alfabético, para los filtros de productos y movimientos.',
        operationId: 'listarCategorias',
        responses: {
          200: json('Nombres de categoría', { type: 'array', items: { type: 'string' } }, [
            'Abarrotes',
            'Bebidas',
            'Botanas',
            'Electrónica',
            'Ferretería',
            'Higiene personal',
            'Limpieza',
            'Papelería',
          ]),
          401: respuesta('NoAutenticado'),
          403: respuesta('SinInventario'),
          500: error500,
        },
      },
    },

    // ------------------------------------------------------------ Integraciones
    '/integraciones/n8n/solicitudes': {
      post: {
        tags: ['Integraciones'],
        summary: 'Registrar la solicitud de reposición de una alerta (n8n)',
        description:
          'Para el flujo de n8n, no para personas: no usa el token de sesión. Se autentica con el encabezado `X-StockAlert-Token`, ' +
          'el mismo valor (`N8N_WEBHOOK_TOKEN`) que la API envía en el aviso `alertaGenerada`.\n\n' +
          'Crea la solicitud de reposición de la alerta indicada, en estado `pendiente`. Si no se envía `cantidad_sugerida`, se calcula con el stock ' +
          'actual del producto: `max(1, 2 × stock_minimo − stock_actual)` (lo necesario para llegar al doble del mínimo).\n\n' +
          '**Idempotente**: hay como máximo una solicitud por alerta. Si n8n reintenta, responde 200 con la solicitud que ya existía (sin cambiarla) ' +
          'en lugar de duplicarla.',
        operationId: 'registrarSolicitudN8n',
        security: [{ tokenN8n: [] }],
        requestBody: cuerpoJsonVarios('SolicitudN8nEntrada', {
          sugerida: { summary: 'Con la cantidad del aviso', value: { id_alerta: 209, cantidad_sugerida: 15, notas: 'Aviso enviado a 1 administrador' } },
          calculada: { summary: 'Solo la alerta (la API calcula la cantidad)', value: { id_alerta: 209 } },
        }),
        responses: {
          201: json('Solicitud creada', ref('Solicitud'), { ...ejemploSolicitud, notas: 'Aviso enviado a 1 administrador' }),
          200: json('La alerta ya tenía solicitud: se devuelve la existente, sin cambios', ref('Solicitud'), {
            ...ejemploSolicitud,
            notas: 'Aviso enviado a 1 administrador',
          }),
          400: errorCuerpo(
            'id_alerta es obligatorio',
            'id_alerta debe ser un número entero',
            'cantidad_sugerida debe ser mayor o igual a 1',
            'cantidad_sugerida debe ser menor o igual a 1000000',
            'notas admite como máximo 1000 caracteres',
          ),
          401: errorRespuesta('X-StockAlert-Token inválido', 'Falta el encabezado X-StockAlert-Token o no coincide con N8N_WEBHOOK_TOKEN'),
          404: noEncontradoRespuesta('Alerta', 'No existe una alerta con ese id_alerta'),
          500: error500,
          503: errorRespuesta(
            'La integración con n8n no está configurada (falta N8N_WEBHOOK_TOKEN)',
            'El servidor no tiene definido N8N_WEBHOOK_TOKEN: el endpoint está deshabilitado',
          ),
        },
      },
    },

    // ------------------------------------------------------------ Sistema
    '/salud': {
      get: {
        tags: ['Sistema'],
        summary: 'Verificar que la API responde',
        description: 'Público. No consulta la base de datos.',
        operationId: 'salud',
        security: [],
        responses: {
          200: json('La API está en línea', { type: 'object', required: ['ok'], properties: { ok: { type: 'boolean', const: true } } }, { ok: true }),
        },
      },
    },
    '/openapi.json': {
      get: {
        tags: ['Sistema'],
        summary: 'Especificación OpenAPI',
        description: 'Público. Esta misma especificación en JSON, para Postman, generadores de clientes, etc.',
        operationId: 'especificacionOpenApi',
        security: [],
        responses: {
          200: {
            description: 'Documento OpenAPI 3.1',
            content: { 'application/json': { schema: { type: 'object', description: 'Documento OpenAPI 3.1' } } },
          },
        },
      },
    },
    '/docs': {
      get: {
        tags: ['Sistema'],
        summary: 'Documentación interactiva (Swagger UI)',
        description: 'Público. Página HTML de Swagger UI para leer y probar los endpoints.',
        operationId: 'documentacion',
        security: [],
        responses: {
          200: { description: 'Página HTML', content: { 'text/html': { schema: { type: 'string' } } } },
        },
      },
    },
  },
  webhooks: {
    alertaGenerada: {
      post: {
        tags: ['Integraciones'],
        summary: 'Aviso a n8n de una alerta nueva',
        description:
          'La API hace este `POST` a la URL configurada en `N8N_WEBHOOK_URL` cada vez que se genera una alerta (al registrar un movimiento, ' +
          'al dar de alta un producto con stock inicial bajo el mínimo o al subir su `stock_minimo`). Si `N8N_WEBHOOK_URL` no está definida, no se envía nada.\n\n' +
          '- Se envía después de confirmar la transacción, una vez por alerta.\n' +
          '- Si `N8N_WEBHOOK_TOKEN` está definido, va en el encabezado `X-StockAlert-Token` para que el flujo valide el origen.\n' +
          '- La API espera la respuesta **máximo 3 segundos**. Si n8n tarda más, falla o responde algo distinto de 2xx, solo se registra en el log: ' +
          'la operación del usuario no se revierte y **no hay reintentos**. En `POST /movimientos` el resultado se refleja en `n8n_notificado`.\n\n' +
          'El cuerpo trae todo lo que el flujo necesita: la alerta, el producto (siempre con la misma forma, leído después del cambio), ' +
          'la empresa con sus administradores activos (a quién avisar por correo) y la cantidad sugerida para reponer, ' +
          '`max(1, 2 × stock_minimo − stock_actual)`. Con ello, el flujo avisa a los administradores y registra la solicitud de reposición ' +
          'con `POST /integraciones/n8n/solicitudes` (enviando el mismo `X-StockAlert-Token`).',
        operationId: 'webhookAlertaGenerada',
        security: [],
        parameters: [
          {
            name: 'X-StockAlert-Token',
            in: 'header',
            required: false,
            description: 'Valor de `N8N_WEBHOOK_TOKEN`. Solo se envía si está configurado.',
            schema: { type: 'string' },
            example: 'token-compartido-con-n8n',
          },
        ],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: ref('WebhookAlertaGenerada'),
              example: {
                evento: 'alerta.generada',
                alerta: { ...ejemploAlertaGenerada, stock_detectado: 9 },
                producto: { id_producto: 10, nombre: 'Hojas blancas paquete 500', categoria: 'Papelería', stock_actual: 9, stock_minimo: 10, faltante: 1 },
                empresa: { ...EMPRESA_DEMO, admins: [{ nombre: ejemploSesionAdmin.nombre, correo: ejemploSesionAdmin.correo }] },
                reposicion: { cantidad_sugerida: 11 },
              },
            },
          },
        },
        responses: {
          200: { description: 'n8n recibió el aviso (cualquier respuesta 2xx cuenta como recibida; el cuerpo se ignora)' },
        },
      },
    },
  },
  components: {
    securitySchemes: {
      bearerAuth: {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
        description:
          'Token de acceso de `POST /auth/login`, `POST /auth/registro` o `POST /auth/refresh`, firmado con HS256. Dura **15 minutos**; ' +
          'al vencer (401), pide otro con `POST /auth/refresh` y repite la petición. Deja de funcionar de inmediato si se cierra su sesión.',
      },
      cookieRefresh: {
        type: 'apiKey',
        in: 'cookie',
        name: 'stockalert_refresh',
        description:
          'Refresh token del cliente web (30 días), en una cookie httpOnly con `Path=/api/auth` y `SameSite=Strict` (`Secure` en producción). ' +
          'La crean login, registro y refresh; el navegador la envía sola a `/auth/refresh` y `/auth/logout` si la petición usa ' +
          '`credentials: "include"`. JavaScript no puede leerla. La app móvil no la usa: envía `refresh_token` en el cuerpo.',
      },
      tokenN8n: {
        type: 'apiKey',
        in: 'header',
        name: 'X-StockAlert-Token',
        description:
          'Token compartido con el flujo de n8n (variable `N8N_WEBHOOK_TOKEN` del servidor). Es el mismo que la API envía en el aviso `alertaGenerada`. ' +
          'Si el servidor no lo tiene configurado, los endpoints de integración responden 503.',
      },
    },
    headers: {
      SetCookieRefresh: {
        description:
          'Solo cliente web: cookie httpOnly con el refresh token nuevo (30 días). El cliente móvil no la recibe: el token viene en el JSON.',
        schema: { type: 'string' },
        example: `stockalert_refresh=${ejemploRefresh}; Max-Age=2592000; Path=/api/auth; Expires=Tue, 22 Dec 2026 17:40:00 GMT; HttpOnly; Secure; SameSite=Strict`,
      },
    },
    responses: {
      NoAutenticado: erroresRespuesta(
        'Falta el token de acceso, no es válido, ya expiró, su sesión se cerró o el usuario (o su empresa) fue desactivado. ' +
          'Pide un token nuevo con `POST /auth/refresh` (una vez) y repite la petición; si el refresh también responde 401, inicia sesión de nuevo.',
        [
          'Inicia sesión: falta el token (Authorization: Bearer <token>)',
          'El token de acceso expiró o no es válido. Renuévalo con /api/auth/refresh.',
          'El usuario ya no tiene acceso. Inicia sesión de nuevo.',
        ],
      ),
      SinPermiso: errorRespuesta('Tu rol no tiene permiso para esta acción', 'El rol del usuario no puede usar este endpoint'),
      SinInventario: errorRespuesta(
        'Los administradores de la plataforma no tienen inventario: inicia sesión con un usuario de la empresa',
        'Un usuario con rol plataforma no tiene empresa ni inventario',
      ),
      ProhibidoInventario: erroresRespuesta('El rol del usuario no puede hacer esta acción o no tiene inventario (rol plataforma)', [
        'Tu rol no tiene permiso para esta acción',
        'Los administradores de la plataforma no tienen inventario: inicia sesión con un usuario de la empresa',
      ]),
      EmpresaNoEncontrada: noEncontradoRespuesta('Empresa', 'Empresa inexistente'),
      UsuarioNoEncontrado: noEncontradoRespuesta('Usuario'),
      ProductoNoEncontrado: noEncontradoRespuesta('Producto'),
      MovimientoNoEncontrado: noEncontradoRespuesta('Movimiento'),
      AlertaNoEncontrada: noEncontradoRespuesta('Alerta'),
      SolicitudNoEncontrada: noEncontradoRespuesta('Solicitud'),
    },
    parameters: {
      id: {
        name: 'id',
        in: 'path',
        required: true,
        description: 'Identificador del registro. Un valor que no es entero positivo responde 404.',
        schema: { type: 'integer', minimum: 1, maximum: 2147483647 },
        example: 10,
      },
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
      id_producto: {
        name: 'id_producto',
        in: 'query',
        description: 'Solo los registros de este producto',
        schema: { type: 'integer', minimum: 1 },
        example: 10,
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
      // ---- Sesión y cuentas
      Rol: {
        type: 'string',
        enum: ['plataforma', 'admin', 'almacen'],
        description: '`plataforma`: administra empresas y usuarios, sin inventario · `admin`: dueño de una empresa · `almacen`: registra movimientos',
      },
      UsuarioSesion: {
        type: 'object',
        required: ['id_usuario', 'nombre', 'correo', 'rol', 'empresa'],
        properties: {
          id_usuario: { type: 'integer' },
          nombre: { type: 'string' },
          correo: { type: 'string', format: 'email' },
          rol: ref('Rol'),
          empresa: {
            type: ['object', 'null'],
            description: 'Empresa del usuario; null para el rol plataforma',
            required: ['id_empresa', 'nombre'],
            properties: { id_empresa: { type: 'integer' }, nombre: { type: 'string' } },
          },
        },
      },
      SesionRespuesta: {
        type: 'object',
        required: ['token', 'expira_en', 'usuario'],
        properties: {
          token: { type: 'string', description: 'Token de acceso (JWT) para el encabezado `Authorization: Bearer <token>`; dura 15 minutos' },
          expira_en: { type: 'integer', const: 900, description: 'Segundos de vida del token de acceso' },
          usuario: ref('UsuarioSesion'),
          refresh_token: {
            type: 'string',
            description: 'Solo cliente `movil`: refresh token para `POST /auth/refresh` y `POST /auth/logout`. Guárdalo en almacenamiento seguro. En web va en la cookie.',
          },
          refresh_expira_en: { type: 'integer', const: 2592000, description: 'Solo cliente `movil`: segundos de vida del refresh token (30 días)' },
        },
      },
      RefreshEntrada: {
        type: 'object',
        properties: {
          refresh_token: {
            type: 'string',
            description: 'Refresh token de la app móvil. Si no se envía, se usa la cookie `stockalert_refresh` (web).',
          },
        },
      },
      LoginEntrada: {
        type: 'object',
        required: ['correo', 'contrasena'],
        properties: {
          correo: { type: 'string', format: 'email', maxLength: 150, description: 'Sin distinguir mayúsculas' },
          contrasena: { type: 'string', maxLength: 128 },
          cliente: {
            type: 'string',
            enum: ['web', 'movil'],
            default: 'web',
            description: '`web`: refresh token en la cookie httpOnly · `movil`: refresh token en el JSON de la respuesta',
          },
        },
      },
      RegistroEntrada: {
        type: 'object',
        required: ['empresa', 'nombre', 'correo', 'contrasena'],
        properties: {
          empresa: { type: 'string', minLength: 2, maxLength: 150, description: 'Nombre del negocio' },
          nombre: { type: 'string', minLength: 2, maxLength: 100, description: 'Nombre del dueño' },
          correo: { type: 'string', format: 'email', maxLength: 150, description: 'Se guarda en minúsculas; no puede estar registrado' },
          contrasena: { type: 'string', minLength: 8, maxLength: 128 },
          cliente: {
            type: 'string',
            enum: ['web', 'movil'],
            default: 'web',
            description: '`web`: refresh token en la cookie httpOnly · `movil`: refresh token en el JSON de la respuesta',
          },
        },
      },
      CambioContrasenaEntrada: {
        type: 'object',
        required: ['actual', 'nueva'],
        properties: {
          actual: { type: 'string', maxLength: 128, description: 'Contraseña vigente' },
          nueva: { type: 'string', minLength: 8, maxLength: 128 },
        },
      },
      Empresa: {
        type: 'object',
        required: ['id_empresa', 'nombre', 'fecha_registro', 'estado', 'usuarios', 'productos'],
        properties: {
          id_empresa: { type: 'integer' },
          nombre: { type: 'string', maxLength: 150 },
          fecha_registro: { type: 'string', format: 'date-time' },
          estado: { type: 'boolean', description: 'false: desactivada (sus usuarios no pueden entrar)' },
          usuarios: { type: 'integer', description: 'Usuarios activos de la empresa' },
          productos: { type: 'integer', description: 'Productos activos de la empresa' },
        },
      },
      AdminNuevo: {
        type: 'object',
        description: 'Cuenta del dueño (rol admin) que se crea junto con la empresa',
        required: ['nombre', 'correo', 'contrasena'],
        properties: {
          nombre: { type: 'string', minLength: 2, maxLength: 100 },
          correo: { type: 'string', format: 'email', maxLength: 150 },
          contrasena: { type: 'string', minLength: 8, maxLength: 128 },
        },
      },
      EmpresaNueva: {
        type: 'object',
        required: ['nombre'],
        properties: {
          nombre: { type: 'string', minLength: 2, maxLength: 150 },
          admin: { anyOf: [ref('AdminNuevo'), { type: 'null' }], description: 'Opcional; null o ausente: solo se crea la empresa' },
        },
      },
      EmpresaCambios: {
        type: 'object',
        minProperties: 1,
        description: 'Al menos un campo',
        properties: {
          nombre: { type: 'string', minLength: 2, maxLength: 150 },
          estado: { type: 'boolean', description: 'false desactiva la empresa; true la reactiva' },
        },
      },
      Usuario: {
        type: 'object',
        required: ['id_usuario', 'nombre', 'correo', 'rol', 'estado', 'fecha_registro', 'id_empresa', 'empresa'],
        properties: {
          id_usuario: { type: 'integer' },
          nombre: { type: 'string', maxLength: 100 },
          correo: { type: 'string', format: 'email', maxLength: 150 },
          rol: ref('Rol'),
          estado: { type: 'boolean', description: 'false: desactivado (no puede iniciar sesión)' },
          fecha_registro: { type: 'string', format: 'date-time' },
          id_empresa: { type: ['integer', 'null'], description: 'null para el rol plataforma' },
          empresa: { type: ['string', 'null'], description: 'Nombre de la empresa; null para el rol plataforma' },
        },
      },
      UsuarioNuevo: {
        type: 'object',
        required: ['nombre', 'correo', 'contrasena', 'rol'],
        properties: {
          nombre: { type: 'string', minLength: 2, maxLength: 100 },
          correo: { type: 'string', format: 'email', maxLength: 150, description: 'Se guarda en minúsculas; no puede estar registrado' },
          contrasena: { type: 'string', minLength: 8, maxLength: 128 },
          rol: {
            type: 'string',
            enum: ['plataforma', 'admin', 'almacen'],
            description: 'Un admin solo puede crear `admin` o `almacen`',
          },
          id_empresa: {
            type: 'integer',
            minimum: 1,
            description: 'Obligatorio solo para el rol plataforma al crear un `admin` o `almacen` (empresa activa). Un admin no lo envía: se usa su empresa.',
          },
        },
      },
      UsuarioCambios: {
        type: 'object',
        minProperties: 1,
        description: 'Al menos un campo',
        properties: {
          nombre: { type: 'string', minLength: 2, maxLength: 100 },
          correo: { type: 'string', format: 'email', maxLength: 150 },
          rol: { type: 'string', enum: ['admin', 'almacen'], description: 'Solo entre admin y almacen; no el propio' },
          estado: { type: 'boolean', description: 'false lo desactiva (no el propio); true lo reactiva' },
          contrasena: { type: 'string', minLength: 8, maxLength: 128, description: 'Contraseña nueva' },
        },
      },

      // ---- Inventario
      Producto: {
        type: 'object',
        required: [
          'id_producto',
          'nombre',
          'descripcion',
          'categoria',
          'stock_actual',
          'stock_minimo',
          'precio',
          'fecha_actualizacion',
          'estado',
          'estado_stock',
        ],
        properties: {
          id_producto: { type: 'integer' },
          nombre: { type: 'string', maxLength: 150 },
          descripcion: { type: ['string', 'null'], maxLength: 2000 },
          categoria: { type: ['string', 'null'], maxLength: 80 },
          stock_actual: { type: 'integer', minimum: 0 },
          stock_minimo: { type: 'integer', minimum: 0 },
          precio: { type: 'number', minimum: 0, description: 'Precio en pesos mexicanos' },
          fecha_actualizacion: { type: 'string', format: 'date-time' },
          estado: { type: 'boolean', description: 'false: desactivado (no acepta movimientos)' },
          estado_stock: ref('EstadoStock'),
        },
      },
      EstadoStock: {
        type: 'string',
        enum: ['agotado', 'bajo', 'ok'],
        description: '`agotado`: stock 0 · `bajo`: por debajo del mínimo · `ok`: en o por encima del mínimo',
      },
      ProductoGuardado: {
        description: 'Producto después de crearlo o editarlo, con la alerta que se haya generado',
        allOf: [
          ref('Producto'),
          {
            type: 'object',
            required: ['alerta_generada'],
            properties: {
              alerta_generada: {
                anyOf: [ref('AlertaGenerada'), { type: 'null' }],
                description: 'Alerta nueva por quedar bajo el mínimo; null si no se generó',
              },
            },
          },
        ],
      },
      ProductoNuevo: {
        type: 'object',
        required: ['nombre', 'precio', 'stock_minimo'],
        properties: {
          nombre: { type: 'string', minLength: 1, maxLength: 150 },
          descripcion: { type: ['string', 'null'], maxLength: 2000 },
          categoria: { type: ['string', 'null'], maxLength: 80, description: 'Texto libre; las existentes se consultan en `GET /categorias`' },
          precio: { type: 'number', minimum: 0, exclusiveMaximum: 10000000000, description: 'Se redondea a 2 decimales' },
          stock_minimo: { type: 'integer', minimum: 0, maximum: 1000000000 },
          stock_inicial: {
            type: 'integer',
            minimum: 0,
            maximum: 1000000000,
            default: 0,
            description: 'Si es mayor que 0 se registra como movimiento de entrada "Inventario inicial"',
          },
        },
      },
      ProductoCambios: {
        type: 'object',
        minProperties: 1,
        description: 'Al menos un campo. `stock_actual` no se acepta: el stock cambia solo con movimientos.',
        properties: {
          nombre: { type: 'string', minLength: 1, maxLength: 150 },
          descripcion: { type: ['string', 'null'], maxLength: 2000, description: 'null o "" la borra' },
          categoria: { type: ['string', 'null'], maxLength: 80, description: 'null o "" la borra' },
          precio: { type: 'number', minimum: 0, exclusiveMaximum: 10000000000, description: 'Se redondea a 2 decimales' },
          stock_minimo: { type: 'integer', minimum: 0, maximum: 1000000000 },
          estado: { type: 'boolean', description: 'false lo desactiva; true lo reactiva' },
        },
      },
      Movimiento: {
        type: 'object',
        required: [
          'id_movimiento',
          'fecha_movimiento',
          'tipo_movimiento',
          'cantidad',
          'observaciones',
          'id_producto',
          'producto',
          'categoria',
          'id_usuario',
          'usuario',
        ],
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
          categoria: { type: ['string', 'null'] },
          id_usuario: { type: 'integer', description: 'Quién registró el movimiento' },
          usuario: { type: 'string', description: 'Nombre de quien registró el movimiento' },
        },
      },
      MovimientoNuevo: {
        type: 'object',
        required: ['id_producto', 'tipo_movimiento', 'cantidad'],
        properties: {
          id_producto: { type: 'integer', minimum: 1, description: 'Producto activo de la empresa' },
          tipo_movimiento: { type: 'string', enum: ['entrada', 'salida', 'ajuste'] },
          cantidad: {
            type: 'integer',
            minimum: -1000000,
            maximum: 1000000,
            not: { const: 0 },
            description:
              'Entradas y salidas: de 1 a 1,000,000 (la salida resta). Ajustes: de −1,000,000 a 1,000,000 sin 0; negativo resta. ' +
              'Una salida o ajuste que dejaría el stock negativo responde 409.',
          },
          observaciones: { type: ['string', 'null'], maxLength: 500 },
        },
      },
      ProductoStock: {
        type: 'object',
        description: 'Stock del producto después del movimiento',
        required: ['id_producto', 'nombre', 'categoria', 'stock_actual', 'stock_minimo', 'estado_stock'],
        properties: {
          id_producto: { type: 'integer' },
          nombre: { type: 'string' },
          categoria: { type: ['string', 'null'] },
          stock_actual: { type: 'integer', minimum: 0 },
          stock_minimo: { type: 'integer', minimum: 0 },
          estado_stock: ref('EstadoStock'),
        },
      },
      MovimientoRegistrado: {
        type: 'object',
        required: ['movimiento', 'producto', 'alerta_generada', 'alertas_atendidas', 'n8n_notificado'],
        properties: {
          movimiento: ref('Movimiento'),
          producto: ref('ProductoStock'),
          alerta_generada: {
            anyOf: [ref('AlertaGenerada'), { type: 'null' }],
            description: 'Alerta nueva por quedar bajo el mínimo o agotarse; null si no se generó',
          },
          alertas_atendidas: { type: 'integer', minimum: 0, description: 'Alertas pendientes que pasaron a atendida porque el stock alcanzó el mínimo' },
          n8n_notificado: { type: 'boolean', description: 'true si n8n confirmó el aviso de la alerta generada; false si no hubo alerta, no está configurado o falló' },
        },
      },
      Alerta: {
        type: 'object',
        required: ['id_alerta', 'id_producto', 'producto', 'categoria', 'tipo_alerta', 'stock_detectado', 'fecha_generacion', 'estado', 'fecha_atencion'],
        properties: {
          id_alerta: { type: 'integer' },
          id_producto: { type: 'integer' },
          producto: { type: 'string', description: 'Nombre del producto' },
          categoria: { type: ['string', 'null'] },
          tipo_alerta: { type: 'string', enum: ['stock_bajo', 'agotado'] },
          stock_detectado: { type: 'integer', description: 'Stock del producto cuando se generó la alerta' },
          fecha_generacion: { type: 'string', format: 'date-time' },
          estado: { type: 'string', enum: ['pendiente', 'atendida', 'cerrada'] },
          fecha_atencion: { type: ['string', 'null'], format: 'date-time', description: 'null mientras está pendiente' },
        },
      },
      AlertaGenerada: {
        type: 'object',
        description: 'Alerta recién creada por un cambio de stock o de stock mínimo',
        required: ['id_alerta', 'id_producto', 'tipo_alerta', 'stock_detectado', 'fecha_generacion', 'estado'],
        properties: {
          id_alerta: { type: 'integer' },
          id_producto: { type: 'integer' },
          tipo_alerta: { type: 'string', enum: ['stock_bajo', 'agotado'] },
          stock_detectado: { type: 'integer', minimum: 0 },
          fecha_generacion: { type: 'string', format: 'date-time' },
          estado: { type: 'string', const: 'pendiente' },
        },
      },
      AlertaCambio: {
        type: 'object',
        required: ['estado'],
        properties: { estado: { type: 'string', enum: ['pendiente', 'atendida', 'cerrada'] } },
      },
      WebhookAlertaGenerada: {
        type: 'object',
        required: ['evento', 'alerta', 'producto', 'empresa', 'reposicion'],
        properties: {
          evento: { type: 'string', const: 'alerta.generada' },
          alerta: ref('AlertaGenerada'),
          producto: {
            type: 'object',
            description: 'Producto con su stock después del cambio (siempre con esta forma)',
            required: ['id_producto', 'nombre', 'categoria', 'stock_actual', 'stock_minimo', 'faltante'],
            properties: {
              id_producto: { type: 'integer' },
              nombre: { type: 'string' },
              categoria: { type: ['string', 'null'] },
              stock_actual: { type: 'integer', minimum: 0 },
              stock_minimo: { type: 'integer', minimum: 0 },
              faltante: { type: 'integer', description: 'stock_minimo − stock_actual' },
            },
          },
          empresa: {
            type: 'object',
            required: ['id_empresa', 'nombre', 'admins'],
            properties: {
              id_empresa: { type: 'integer' },
              nombre: { type: 'string' },
              admins: {
                type: 'array',
                description: 'Usuarios activos con rol admin de la empresa (a quién avisar), en orden alfabético; vacío si no hay',
                items: {
                  type: 'object',
                  required: ['nombre', 'correo'],
                  properties: { nombre: { type: 'string' }, correo: { type: 'string', format: 'email' } },
                },
              },
            },
          },
          reposicion: {
            type: 'object',
            required: ['cantidad_sugerida'],
            properties: {
              cantidad_sugerida: {
                type: 'integer',
                minimum: 1,
                description: 'Unidades a pedir para llegar al doble del mínimo: max(1, 2 × stock_minimo − stock_actual)',
              },
            },
          },
        },
      },

      // ---- Solicitudes de reposición
      EstadoSolicitud: {
        type: 'string',
        enum: ['pendiente', 'pedida', 'recibida', 'cancelada'],
        description:
          '`pendiente`: recién registrada · `pedida`: se hizo el pedido al proveedor · `recibida`: llegó la mercancía (se registra aparte con un movimiento de entrada) · `cancelada`: no se repondrá',
      },
      Solicitud: {
        type: 'object',
        required: [
          'id_solicitud',
          'id_producto',
          'producto',
          'categoria',
          'stock_actual',
          'stock_minimo',
          'id_alerta',
          'tipo_alerta',
          'cantidad_sugerida',
          'estado',
          'notas',
          'fecha_creacion',
          'fecha_actualizacion',
        ],
        properties: {
          id_solicitud: { type: 'integer' },
          id_producto: { type: 'integer' },
          producto: { type: 'string', description: 'Nombre del producto' },
          categoria: { type: ['string', 'null'] },
          stock_actual: { type: 'integer', minimum: 0, description: 'Stock actual del producto (no el del momento de la alerta)' },
          stock_minimo: { type: 'integer', minimum: 0 },
          id_alerta: { type: ['integer', 'null'], description: 'Alerta que originó la solicitud' },
          tipo_alerta: { type: ['string', 'null'], enum: ['stock_bajo', 'agotado', null], description: 'Tipo de la alerta de origen' },
          cantidad_sugerida: { type: 'integer', minimum: 1 },
          estado: ref('EstadoSolicitud'),
          notas: { type: ['string', 'null'] },
          fecha_creacion: { type: 'string', format: 'date-time' },
          fecha_actualizacion: { type: 'string', format: 'date-time', description: 'Último cambio con PATCH' },
        },
      },
      SolicitudCambios: {
        type: 'object',
        minProperties: 1,
        description: 'Al menos un campo',
        properties: {
          estado: ref('EstadoSolicitud'),
          cantidad_sugerida: { type: 'integer', minimum: 1, maximum: 1000000 },
          notas: { type: ['string', 'null'], maxLength: 1000, description: 'null o "" las borra' },
        },
      },
      SolicitudN8nEntrada: {
        type: 'object',
        required: ['id_alerta'],
        properties: {
          id_alerta: { type: 'integer', minimum: 1, description: 'Alerta del aviso `alertaGenerada`' },
          cantidad_sugerida: {
            type: 'integer',
            minimum: 1,
            maximum: 1000000,
            description: 'Opcional; si falta: max(1, 2 × stock_minimo − stock_actual) con el stock actual del producto',
          },
          notas: { type: ['string', 'null'], maxLength: 1000 },
        },
      },
      ResumenSolicitudes: {
        type: 'object',
        description: 'Número de solicitudes de la empresa en cada estado',
        required: ['pendiente', 'pedida', 'recibida', 'cancelada'],
        properties: {
          pendiente: { type: 'integer', minimum: 0 },
          pedida: { type: 'integer', minimum: 0 },
          recibida: { type: 'integer', minimum: 0 },
          cancelada: { type: 'integer', minimum: 0 },
        },
      },

      // ---- Dashboard
      ProductoPorReponer: {
        type: 'object',
        required: ['id_producto', 'nombre', 'categoria', 'stock_actual', 'stock_minimo', 'faltante'],
        properties: {
          id_producto: { type: 'integer' },
          nombre: { type: 'string' },
          categoria: { type: ['string', 'null'] },
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
              inicio: {
                type: ['string', 'null'],
                format: 'date-time',
                description: 'Primer día del periodo (hora de Mérida); null si la empresa no tiene movimientos',
              },
              fin: {
                type: ['string', 'null'],
                format: 'date-time',
                description: 'Último movimiento registrado; null si la empresa no tiene movimientos',
              },
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
                description: 'Proporción de cambio contra el periodo anterior (−0.059 = −5.9 %); null sin periodo anterior o si fue 0',
              },
            },
          },
          categoriaTop: {
            type: ['object', 'null'],
            description: 'Indicador 3: categoría más vendida; null si no hubo ventas',
            properties: {
              categoria: { type: 'string', description: '"Sin categoría" para productos sin categoría' },
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
            description: 'Gráfica de unidades vendidas por categoría, de mayor a menor ("Sin categoría" agrupa los productos sin categoría)',
            items: {
              type: 'object',
              properties: { categoria: { type: 'string' }, unidades: { type: 'integer' } },
            },
          },
          porReponer: {
            type: 'array',
            description: 'Productos activos bajo su mínimo, del mayor faltante al menor',
            items: { $ref: '#/components/schemas/ProductoPorReponer' },
          },
        },
      },
      PaginaEmpresas: paginaDe('Empresa'),
      PaginaUsuarios: paginaDe('Usuario'),
      PaginaProductos: paginaDe('Producto'),
      PaginaMovimientos: paginaDe('Movimiento'),
      PaginaAlertas: paginaDe('Alerta'),
      PaginaSolicitudes: paginaDe('Solicitud'),
      Error: {
        type: 'object',
        required: ['error'],
        properties: { error: { type: 'string', description: 'Mensaje en español' } },
      },
    },
  },
};
