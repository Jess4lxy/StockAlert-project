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
├── etl/        Generación de datos sintéticos, limpieza y carga a PostgreSQL
├── db/         Esquema SQL, migraciones y consultas de validación
└── docs/       Documentación de cada tarea (diagramas, modelo de datos, resultados)
```

## Configuración

1. Copiar `.env.example` a `.env` y ajustar los valores. **El archivo `.env` nunca se sube al repositorio.**
2. Las instrucciones para levantar la base de datos, ejecutar el ETL y correr la aplicación se agregan conforme avanza el proyecto.

## Entregas

| Tarea | Tema | Documentación |
|---|---|---|
| 1 | Mapa de datos y propuesta de arquitectura | [`docs/tarea1`](docs/tarea1) |
| 2 | Proceso ETL y base de datos de prueba | [`docs/tarea2`](docs/tarea2) |
| 3 | Dashboard y prueba comparativa de rendimiento | [`docs/tarea3`](docs/tarea3) |
