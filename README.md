# StockAlert

**Inventario inteligente para tu negocio.** Aplicación web que automatiza el control de inventario de pequeños negocios (papelerías, abarrotes, talleres): registra productos y movimientos de entrada/salida, detecta cuándo un producto baja de su stock mínimo y dispara una alerta y una solicitud de reposición mediante n8n.

Equipo IDGS10B — Universidad Tecnológica Metropolitana:
Buenfil Yunes Julián Nahim · López Uicab Rossana Sofía · Martínez Rivero Allan Alexis · Sima Moo Jafet de Jesús

## Stack

| Capa | Tecnología |
|---|---|
| Frontend | Vue 3 + TypeScript + Vite + Tailwind CSS, instalable como PWA |
| Backend | Node.js + Express |
| Base de datos | PostgreSQL (local con Docker) |
| ETL | Node.js + TypeScript |
| Automatización | n8n |

## Estructura

```
stockalert/
├── backend/    API REST (Express) — productos, movimientos, dashboard
├── frontend/   Aplicación web (Vue 3 + Vite + Tailwind)
├── etl/        Generación de datos sintéticos, limpieza, carga y consultas de validación
├── db/         Esquema SQL
└── docs/       Documentación de cada tarea (diagramas, modelo de datos, resultados)
```

## Configuración

Requisitos: Node.js 20+, Docker Desktop.

1. Copiar `.env.example` a `.env` y llenar las contraseñas (`POSTGRES_PASSWORD`, `API_DB_PASSWORD`, `JWT_SECRET`, `ADMIN1_CONTRASENA` y `ADMIN2_CONTRASENA`) con valores aleatorios distintos (ver [Credenciales](#credenciales)). **El archivo `.env` nunca se sube al repositorio.**
2. Levantar la base de datos y cargar los datos (secciones siguientes).
3. Correr la API y la aplicación web (sección [Aplicación web](#aplicación-web)).

## Base de datos local

Se usa PostgreSQL 16 en Docker en lugar de un servicio en la nube: los planes gratuitos (p. ej. Render) eliminan la base a los 30 días. El esquema está en [`db/schema.sql`](db/schema.sql).

```bash
docker compose up -d      # levanta PostgreSQL en el puerto POSTGRES_PORT
docker compose down       # lo detiene (los datos quedan en el volumen)
docker compose down -v    # lo detiene y borra los datos
```

### Credenciales

La base de datos tiene dos usuarios de PostgreSQL, cada uno con su contraseña en el `.env`:

| Usuario | Variables | Lo usa | Permisos |
|---|---|---|---|
| Dueño de la base | `POSTGRES_USER`, `POSTGRES_PASSWORD` | ETL (`etl/`) | Crea y borra tablas, carga datos, crea índices y usuarios |
| Usuario de la API | `API_DB_USER`, `API_DB_PASSWORD` | API (`backend/`) | `SELECT`, `INSERT` y `UPDATE`: no puede borrar filas ni crear, modificar o borrar tablas |

Para generar cada contraseña:

```bash
node -e "console.log(require('crypto').randomBytes(24).toString('base64url'))"
```

- El puerto se publica solo en `127.0.0.1`: otras computadoras de la red no pueden conectarse a la base. Si el puerto 5432 ya lo ocupa otro PostgreSQL instalado en la computadora, se cambia `POSTGRES_PORT` en el `.env` (por ejemplo, a 5433).
- `npm run etl` crea el usuario de la API (paso `roles`). Para cambiar después su contraseña: se edita `API_DB_PASSWORD` y se corre `npm run roles` en `etl/`.
- `JWT_SECRET` firma los tokens de acceso (mínimo 32 caracteres). Si cambia, los tokens emitidos dejan de valer y los clientes los renuevan con su refresh token.
- Nada se borra físicamente: productos, usuarios y empresas se desactivan (`estado = false`) y los movimientos nunca se editan.
- `POSTGRES_PASSWORD` solo se aplica cuando Docker crea la base por primera vez. Para cambiarla en una base ya creada, se edita en el `.env` y luego, con el contenedor encendido, se ejecuta `docker exec -it stockalert-db psql -U stockalert -d stockalert -c "\password stockalert"` y se escribe la misma contraseña. Otra opción es `docker compose down -v`, que borra la base, y volver a correr `npm run etl`.

## ETL (Tarea 2)

El origen son **datos sintéticos**: un generador con semilla fija crea un negocio ficticio (8 usuarios, 93 productos de 8 categorías y 10,000 movimientos de entrada, salida y ajuste en 12 meses) simulando el stock movimiento por movimiento. Las alertas salen de esa misma simulación. No se usan datos personales reales.

```bash
cd etl
npm install
npm run etl          # generate → transform → load → roles → plataforma → queries
```

Cada paso también se puede correr por separado:

| Comando | Qué hace | Salida |
|---|---|---|
| `npm run generate` | Genera los CSV crudos con errores intencionales: 450 filas extra (300 duplicadas y 150 con campos vacíos, tipos incorrectos o referencias inexistentes) y formatos mezclados | `etl/data/raw/` |
| `npm run transform` | Detecta vacíos, duplicados y tipos incorrectos; normaliza fechas, tipo de movimiento, cantidades, categorías, nombres, precios y correos; cuenta corregidos y descartados | `etl/data/clean/`, `etl/output/reporte_transformacion.json` |
| `npm run load` | Recrea el esquema y carga los CSV limpios en una transacción; muestra el conteo final | PostgreSQL |
| `npm run roles` | Crea o actualiza el usuario de la API (`API_DB_USER`) con `SELECT`, `INSERT` y `UPDATE` sobre las tablas actuales y las que se creen después | PostgreSQL |
| `npm run plataforma` | Crea o actualiza los 2 administradores de la plataforma (`ADMIN1_*`, `ADMIN2_*` del `.env`) | PostgreSQL |
| `npm run migrar` | Aplica las migraciones de [`db/migraciones/`](db/migraciones) (tablas agregadas después del esquema base). No borra datos: es como se actualiza una base en uso, por ejemplo la de Neon con `ENV_FILE=.env.neon npm run migrar`. `npm run load` también las aplica | PostgreSQL |
| `npm run queries` | Ejecuta las consultas de [`etl/sql/consultas.sql`](etl/sql/consultas.sql) | Consola |

Resultado de la transformación (siempre el mismo, por la semilla fija):

| Tabla | Leídos | Sin cambios | Corregidos | Descartados | Cargados |
|---|---:|---:|---:|---:|---:|
| usuarios | 8 | 7 | 1 | 0 | 8 |
| productos | 98 | 37 | 56 | 5 | 93 |
| movimientos | 10,450 | 6,090 | 3,910 | 450 | **10,000** |
| alertas | 208 | 208 | 0 | 0 | 208 |

Todos los datos sintéticos se cargan en la empresa **Tienda Demo StockAlert** (id 1). Sus 8 usuarios ficticios no tienen contraseña: para entrar a la empresa demo, un administrador de la plataforma crea un usuario en ella o le asigna contraseña a uno existente.

En [`etl/data/sample/`](etl/data/sample) hay una muestra de 50 filas de cada archivo crudo. Los archivos completos no se suben porque el generador los vuelve a crear idénticos.

## Aplicación web

En dos terminales, con la base de datos ya cargada:

```bash
cd backend && npm install && npm run dev     # API en http://localhost:3000/api
cd frontend && npm install && npm run dev    # Web en http://localhost:5173
```

### Cuentas, empresas y roles

Cada negocio es una **empresa** y solo ve sus propios productos, movimientos, alertas y usuarios. Sin sesión, la app muestra **Iniciar sesión** y **Registra tu negocio** (registro público: crea la empresa y su administrador).

**Sesión.** El token de acceso (JWT) dura 15 minutos y se envía en `Authorization: Bearer <token>`. Lo renueva un refresh token de 30 días que se rota en cada uso:

- Web: el refresh token viaja en la cookie `stockalert_refresh` (`httpOnly`, `SameSite=Strict`, solo para `/api/auth`), que JavaScript no puede leer. El front solo guarda en el dispositivo los datos del usuario; el token de acceso vive en memoria.
- Móvil: se envía `"cliente": "movil"` en el login o el registro; la respuesta trae `refresh_token`, que la app guarda en su almacenamiento seguro y manda en el cuerpo de `/auth/refresh` y `/auth/logout`.
- Ante un 401 de cualquier endpoint, el cliente llama una vez a `POST /api/auth/refresh` y repite la petición. Un 409 en el refresh significa que otra pestaña acaba de renovar la sesión: se reintenta una vez.
- Si alguien usa un refresh token que ya fue reemplazado, se cierra esa sesión por posible robo. Cerrar sesión, cambiar la contraseña o desactivar al usuario revoca sus sesiones y sus tokens de acceso dejan de valer de inmediato.

| Rol | Quién es | Pantallas |
|---|---|---|
| `plataforma` | Los 2 administradores precargados (`ADMIN1_*`, `ADMIN2_*`); no pertenecen a ninguna empresa | **Empresas** (crear con su administrador, renombrar, activar o desactivar) y **Usuarios** de todas las empresas |
| `admin` | Dueño de una empresa | Inventario completo (crea, edita y desactiva productos) y **Usuarios** de su empresa |
| `almacen` | Encargado de almacén | Inventario: consulta, registra movimientos y atiende alertas |

### Trabajo sin conexión y capacidades del dispositivo

| Capacidad | Dónde está | Qué hace |
|---|---|---|
| IndexedDB | [`datos/bd.ts`](frontend/src/datos/bd.ts) | Una base por usuario (`stockalert-u<id>`): copia del catálogo, cola de operaciones, fotos y datos sueltos. Al cerrar sesión solo se conserva la cola |
| Sincronización | [`datos/inventario.ts`](frontend/src/datos/inventario.ts) | Toda escritura se envía al momento o entra a la cola; se envía en orden al volver la red (evento `online`, al abrir la app y cada 15 s) |
| Cámara | [`dispositivo/escaner.ts`](frontend/src/dispositivo/escaner.ts), [`foto.ts`](frontend/src/dispositivo/foto.ts) | Código de barras con `BarcodeDetector` o ZXing, y foto del producto reducida a 800 px antes de guardarse |
| Notificaciones | [`dispositivo/notificaciones.ts`](frontend/src/dispositivo/notificaciones.ts) | Aviso del sistema cuando un producto baja de su mínimo (se activa en Alertas) |
| Compartir | [`dispositivo/compartir.ts`](frontend/src/dispositivo/compartir.ts) | Lista de productos por reponer con Web Share; sin soporte, se copia |

Cada alta y movimiento lleva una `clave_cliente` (UUID): si se reenvía porque se perdió la respuesta, la API la reconoce y no la aplica dos veces. Los movimientos conservan en `fecha_movimiento` cuándo ocurrieron. Lo que la API rechaza (por ejemplo, stock insuficiente) queda en **Pendientes de enviar** con su motivo, para reintentarlo o descartarlo. Si dos personas editan el mismo producto, se guarda el último cambio de cada campo. Sin conexión no se pueden atender alertas ni administrar usuarios y empresas.

### Pantallas del inventario

La sección activa se guarda en el hash de la URL (`#/productos`):

| Pantalla | Qué muestra |
|---|---|
| **Dashboard** | Indicadores y gráficas, ver [Tarea 3](#dashboard-y-prueba-de-rendimiento-tarea-3) |
| **Productos** | Catálogo con stock actual contra mínimo; primero los de mayor faltante. Búsqueda y filtros por estado de stock y categoría |
| **Movimientos** | Entradas, salidas y ajustes, con búsqueda y filtros por tipo y categoría |
| **Alertas** | Alertas de stock bajo o agotado, con filtros por estado y tipo, y totales de pendientes y registradas |

La búsqueda, los filtros y la paginación (10, 20, 50 o 100 por página) se resuelven en PostgreSQL con `LIMIT`/`OFFSET`, así que el navegador solo descarga la página que muestra y nunca los 10,000 registros.

### API

La documentación completa, con cada parámetro, cuerpo, respuesta y ejemplo, está en **Swagger**: https://stockalert-beta.vercel.app/api/docs (en local, http://localhost:3000/api/docs). La especificación vive en [`backend/src/openapi.ts`](backend/src/openapi.ts): al agregar o cambiar un endpoint hay que actualizarla.

Todo exige `Authorization: Bearer <token>`, salvo `GET /api/salud`, `POST /api/auth/login`, `POST /api/auth/registro` y la documentación. Los errores responden `{ "error": "mensaje" }`.

| Recurso | Endpoints (bajo `/api`) | Quién |
|---|---|---|
| Sesión | `POST /auth/login`, `POST /auth/registro`, `POST /auth/refresh`, `POST /auth/logout`, `GET /auth/yo`, `PATCH /auth/contrasena` | Público / cualquier sesión |
| Empresas | `GET` y `POST /empresas`; `GET` y `PATCH /empresas/:id` | `plataforma` |
| Usuarios | `GET` y `POST /usuarios`; `GET` y `PATCH /usuarios/:id` | `plataforma` (todas las empresas) y `admin` (la suya) |
| Productos | `GET /productos`, `GET /productos/:id`; `POST`, `PATCH` y `DELETE` (desactiva); `GET`, `PUT` y `DELETE /productos/:id/foto` | Consultar: `admin` y `almacen`. Escribir: `admin` |
| Movimientos | `GET /movimientos` (también por `id_producto`, `desde` y `hasta`), `GET /movimientos/:id`, `POST /movimientos` | Registrar: `admin` y `almacen` |
| Alertas | `GET /alertas`, `GET /alertas/resumen`, `GET /alertas/:id`, `PATCH /alertas/:id` (estado) | Cambiar estado: `admin` y `almacen` |
| Solicitudes de reposición | `GET /solicitudes`, `GET /solicitudes/resumen`, `GET /solicitudes/:id`, `PATCH /solicitudes/:id` (estado, cantidad, notas) | `admin` y `almacen` |
| Integración con n8n | `POST /integraciones/n8n/solicitudes` | n8n, con el encabezado `X-StockAlert-Token` |
| Dashboard y catálogos | `GET /dashboard?meses=3`, `6` o `12`; `GET /categorias` | `admin` y `almacen` |

Reglas del inventario:

- El stock solo cambia con movimientos. `POST /movimientos` registra el movimiento, actualiza el stock y genera o atiende alertas en una sola transacción, y rechaza (409) una salida mayor que el stock. Un error se corrige con un ajuste: los movimientos no se editan ni se borran.
- Se genera una alerta cuando el stock queda por debajo del mínimo (`stock_bajo`, o `agotado` si llega a 0); al reponer, las pendientes pasan a `atendida`. Son las mismas reglas de la simulación del ETL.
- Una solicitud de reposición pasa por `pendiente` → `pedida` → `recibida` (o `cancelada`). Marcarla como recibida no suma stock: la mercancía se registra con un movimiento de entrada.

### Flujo con n8n

```
POST /api/movimientos ──► alerta nueva ──► POST N8N_WEBHOOK_URL ──► n8n: correo a los admins
                                                                    └─► POST /api/integraciones/n8n/solicitudes
```

1. Con `N8N_WEBHOOK_URL` definido, cada alerta nueva se envía por `POST` a ese flujo con el encabezado `X-StockAlert-Token` (`N8N_WEBHOOK_TOKEN`). El aviso trae la alerta, el producto (con `faltante`), la empresa con sus administradores activos (`empresa.admins`: nombre y correo) y `reposicion.cantidad_sugerida` (lo necesario para llegar al doble del mínimo). El formato completo está en Swagger, sección *webhooks*.
2. En n8n: nodo **Webhook** (`POST`, *Header Auth* con `X-StockAlert-Token`, *Respond: Immediately*) → **IF** `evento = alerta.generada` → nodo de **correo** a cada `empresa.admins[].correo`.
3. El flujo registra la solicitud con **HTTP Request**: `POST {API}/api/integraciones/n8n/solicitudes`, encabezado `X-StockAlert-Token` y cuerpo `{ "id_alerta": {{ $json.body.alerta.id_alerta }} }` (opcionales `cantidad_sugerida` y `notas`). Si n8n reintenta, la misma alerta devuelve la solicitud existente: no se duplica.
4. La API espera a n8n un máximo de 3 s y no reintenta; si falla, el movimiento se registra igual. Las variables se agregan al `.env` y, para producción, en Vercel (`vercel env add`), y aplican en el siguiente despliegue. n8n debe tener una URL pública con HTTPS.

`GET /api/movimientos` incluye el encabezado `Server-Timing: db;dur=<ms>` con el tiempo de sus consultas en PostgreSQL; lo usa la prueba de rendimiento.

La interfaz está armada con componentes base reutilizables en [`frontend/src/components/ui`](frontend/src/components/ui) (`AppShell`, `PageHeader`, `FilterBar`, `FormField`, `TextInput`, `SelectInput`, `BaseButton`, `BaseDialog`, `AvisoError`, `DataTable`, `TablePagination`, `StatusBadge`, `StatCard`, `ChartCard`, `AppIcon`) y gráficas en [`frontend/src/components/charts`](frontend/src/components/charts) (`LineChart`, `BarChart`, con Chart.js). Los colores y demás tokens están en `frontend/src/style.css`. Las pantallas viven en `frontend/src/views`.

Los parámetros se envían a PostgreSQL como consultas parametrizadas (`$1`, `$2`…), nunca concatenados al SQL. Si el frontend corre en otro origen, se define `CORS_ORIGIN` en el `.env`, con los orígenes separados por coma (por defecto `http://localhost:5173,http://localhost:4173`).

## Aplicación instalable (PWA)

El Service Worker solo se registra en la versión compilada. Con la API corriendo:

```bash
cd frontend
npm run build
npm run preview      # http://localhost:4173
```

La PWA se puede instalar únicamente desde `localhost` o desde una página con HTTPS. `npm run dev` sirve para programar la interfaz, pero ahí la app no es instalable ni funciona sin conexión.

| Pieza | Dónde está | Qué hace |
|---|---|---|
| Manifest | [`frontend/public/manifest.json`](frontend/public/manifest.json) | Nombre, iconos, colores, modo `standalone` y accesos directos a Dashboard, Productos y Alertas |
| Service Worker | [`frontend/public/sw.js`](frontend/public/sw.js) | Guarda la app al instalarse; [`vite.config.ts`](frontend/vite.config.ts) escribe la lista de archivos y la versión en cada `build` |
| Instalación y avisos | [`usePwa.ts`](frontend/src/pwa/usePwa.ts), [`PwaAvisos.vue`](frontend/src/components/PwaAvisos.vue) | Botón **Instalar app**, indicador **Sin conexión**, aviso de versión nueva e instrucciones para iOS |
| Fuentes e íconos | `@fontsource/inter`, [`AppIcon.vue`](frontend/src/components/ui/AppIcon.vue) | Incluidos en la app, ya no se descargan de Google Fonts |

### Abrirla en el celular (HTTPS)

Un solo túnel de Cloudflare basta: `vite preview` reenvía `/api` a la API local, así que no hay que configurar CORS ni otra URL. Requiere [`cloudflared`](https://developers.cloudflare.com/cloudflare-one/connections/connect-networks/downloads/) (`winget install Cloudflare.cloudflared`). En PowerShell, cada bloque en su terminal:

```powershell
# 1. Base de datos (desde la raíz, con Docker Desktop abierto)
docker compose up -d

# 2. API
cd backend
npm run dev

# 3. Web compilada para usar la API por el mismo dominio
cd frontend
$env:VITE_API_URL = "/api"
npm run build
npm run preview

# 4. Túnel: imprime la URL https://...trycloudflare.com que se abre en el celular
cloudflared tunnel --url http://localhost:4173
```

La URL cambia cada vez que se reinicia el túnel, y la app instalada queda ligada a la URL con la que se instaló. Cualquiera con la URL puede consultar la app mientras el túnel esté abierto. Para volver a compilar contra la API local, abre otra terminal, sin `VITE_API_URL` definida.

**Sin conexión:** los productos se guardan completos en IndexedDB, así que se buscan, filtran y registran sin Internet (ver [Trabajo sin conexión](#trabajo-sin-conexión-y-capacidades-del-dispositivo)). El dashboard, los movimientos y las alertas se consultan con *red primero*: el Service Worker guarda cada respuesta y sin conexión muestra la última. Una consulta que nunca se hizo (otra página o filtro) muestra un mensaje que lo explica.

## Dashboard y prueba de rendimiento (Tarea 3)

### Indicadores

El dashboard calcula los indicadores sobre los últimos 3, 6 o 12 meses calendario hasta el último movimiento registrado:

| Indicador | Dónde se ve | Decisión que apoya |
|---|---|---|
| Productos bajo su stock mínimo | Tarjeta + tabla "Productos por reponer" | Qué comprar hoy y en qué cantidad |
| Unidades vendidas en el periodo (y variación contra el periodo anterior) | Tarjeta + gráfica de entradas y salidas por mes | Cuánto presupuesto de compras planear y si las compras siguen el ritmo de las ventas |
| Categoría más vendida (participación) | Tarjeta + gráfica de unidades vendidas por categoría | A qué categorías dar prioridad de surtido y espacio |

### Prueba de rendimiento

La consulta de referencia es el listado de movimientos (`GET /api/movimientos`), en tres escenarios: primera página sin filtros, búsqueda "cuaderno" + filtro salida, y filtro por categoría en la página 10. La optimización son dos índices en `movimientos` ([`db/indices.sql`](db/indices.sql)).

Con la API corriendo (`backend: npm run dev`), desde `etl/`:

```bash
npm run load                  # base sin índices secundarios (línea base)
npm run bench -- antes        # 5 corridas de calentamiento + 30 medidas por escenario (inicia sesión con BENCH_CORREO y BENCH_CONTRASENA del .env)
npm run indices               # aplica db/indices.sql
npm run bench -- despues
npm run bench:comparar        # medianas antes/después
```

Los resultados se guardan en [`docs/tarea3/resultados`](docs/tarea3/resultados). Medianas obtenidas (tiempo de las consultas en PostgreSQL, 30 corridas):

| Escenario | Antes | Después | Mejora |
|---|---:|---:|---:|
| Primera página sin filtros | 4.88 ms | 3.10 ms | 36.5 % |
| Búsqueda "cuaderno" + filtro salida | 3.23 ms | 2.07 ms | 35.9 % |
| Filtro por categoría, página 10 | 4.45 ms | 2.94 ms | 33.9 % |

## Entregas

| Tarea | Tema | Documentación |
|---|---|---|
| 1 | Mapa de datos y propuesta de arquitectura | [`docs/tarea1`](docs/tarea1) |
| 2 | Proceso ETL y base de datos de prueba | [`docs/tarea2`](docs/tarea2) |
| 3 | Dashboard y prueba comparativa de rendimiento | [`docs/tarea3`](docs/tarea3) |
