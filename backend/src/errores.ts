import type { ErrorRequestHandler } from 'express';

// Error con código HTTP y mensaje para el cliente. Las rutas lo lanzan y el
// manejador de abajo lo convierte en { error: mensaje }.
export class HttpError extends Error {
  constructor(
    public status: number,
    mensaje: string,
  ) {
    super(mensaje);
  }
}

// "Producto no encontrado", "Alerta no encontrada": concuerda con el género del sustantivo
const FEMENINOS = new Set(['Empresa', 'Alerta', 'Solicitud']);
export const noEncontrado = (que: string) => new HttpError(404, `${que} no ${FEMENINOS.has(que) ? 'encontrada' : 'encontrado'}`);

// Errores de PostgreSQL que provienen de datos del cliente (no son fallas del servidor)
const ERRORES_PG: Record<string, [number, string]> = {
  '23505': [409, 'Ya existe un registro con ese valor'], // UNIQUE (p. ej., correo repetido)
  '23503': [409, 'El registro hace referencia a otro que no existe'], // llave foránea
  '23514': [400, 'Un valor no cumple las reglas de la base de datos'], // CHECK
  '22P02': [400, 'Un valor tiene un formato inválido'],
  '22003': [400, 'Un número está fuera del rango permitido'],
};

export const manejarError: ErrorRequestHandler = (error, _req, res, _next) => {
  if (error instanceof HttpError) {
    res.status(error.status).json({ error: error.message });
    return;
  }
  // Cuerpo que no es JSON válido (express.json)
  if (error?.type === 'entity.parse.failed') {
    res.status(400).json({ error: 'El cuerpo de la petición no es JSON válido' });
    return;
  }
  if (error?.type === 'entity.too.large') {
    res.status(413).json({ error: 'El cuerpo de la petición es demasiado grande (máximo 100 KB)' });
    return;
  }
  const pg = ERRORES_PG[error?.code];
  if (pg) {
    res.status(pg[0]).json({ error: pg[1] });
    return;
  }
  console.error(error);
  res.status(500).json({ error: 'Error interno del servidor' });
};
