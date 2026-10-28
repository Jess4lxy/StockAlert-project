# StockAlert

**Inventario inteligente para tu negocio.** Aplicación web que automatiza el control de inventario de pequeños negocios (papelerías, abarrotes, talleres): registra productos y movimientos de entrada/salida, detecta cuándo un producto baja de su stock mínimo y dispara una alerta y una solicitud de reposición mediante n8n.

Equipo IDGS10B — Universidad Tecnológica Metropolitana:
Buenfil Yunes Julián Nahim · López Uicab Rossana Sofía · Martínez Rivero Allan Alexis · Sima Moo Jafet de Jesús

## Stack

| Capa | Tecnología |
|---|---|
| Frontend | Vue 3 + TypeScript + Vite + Tailwind CSS |
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

1. Copiar `.env.example` a `.env` y cambiar la contraseña. **El archivo `.env` nunca se sube al repositorio.**
2. Las instrucciones para correr la aplicación web se agregan conforme avanza el proyecto.

## Base de datos local

Se usa PostgreSQL 16 en Docker en lugar de un servicio en la nube: los planes gratuitos (p. ej. Render) eliminan la base a los 30 días. El esquema está en [`db/schema.sql`](db/schema.sql).

```bash
docker compose up -d      # levanta PostgreSQL en el puerto POSTGRES_PORT
docker compose down       # lo detiene (los datos quedan en el volumen)
docker compose down -v    # lo detiene y borra los datos
```

## ETL (Tarea 2)

El origen son **datos sintéticos**: un generador con semilla fija crea un negocio ficticio (8 usuarios, 93 productos de 8 categorías y 10,000 movimientos de entrada, salida y ajuste en 12 meses) simulando el stock movimiento por movimiento. Las alertas salen de esa misma simulación. No se usan datos personales reales.

```bash
cd etl
npm install
npm run etl          # generate → transform → load → queries
```

Cada paso también se puede correr por separado:

| Comando | Qué hace | Salida |
|---|---|---|
| `npm run generate` | Genera los CSV crudos con errores intencionales: 450 filas extra (300 duplicadas y 150 con campos vacíos, tipos incorrectos o referencias inexistentes) y formatos mezclados | `etl/data/raw/` |
| `npm run transform` | Detecta vacíos, duplicados y tipos incorrectos; normaliza fechas, tipo de movimiento, cantidades, categorías, nombres, precios y correos; cuenta corregidos y descartados | `etl/data/clean/`, `etl/output/reporte_transformacion.json` |
| `npm run load` | Recrea el esquema y carga los CSV limpios en una transacción; muestra el conteo final | PostgreSQL |
| `npm run queries` | Ejecuta las consultas de [`etl/sql/consultas.sql`](etl/sql/consultas.sql) | Consola |

Resultado de la transformación (siempre el mismo, por la semilla fija):

| Tabla | Leídos | Sin cambios | Corregidos | Descartados | Cargados |
|---|---:|---:|---:|---:|---:|
| usuarios | 8 | 7 | 1 | 0 | 8 |
| productos | 98 | 37 | 56 | 5 | 93 |
| movimientos | 10,450 | 6,090 | 3,910 | 450 | **10,000** |
| alertas | 208 | 208 | 0 | 0 | 208 |

En [`etl/data/sample/`](etl/data/sample) hay una muestra de 50 filas de cada archivo crudo. Los archivos completos no se suben porque el generador los vuelve a crear idénticos.

## Entregas

| Tarea | Tema | Documentación |
|---|---|---|
| 1 | Mapa de datos y propuesta de arquitectura | [`docs/tarea1`](docs/tarea1) |
| 2 | Proceso ETL y base de datos de prueba | [`docs/tarea2`](docs/tarea2) |
| 3 | Dashboard y prueba comparativa de rendimiento | [`docs/tarea3`](docs/tarea3) |
