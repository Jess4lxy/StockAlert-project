import type { Request } from 'express';

const LIMITES = [10, 20, 50, 100];

// page empieza en 1; limit acepta 10, 20, 50 o 100 (otro valor usa 20)
export function paginacion(req: Request) {
  const limit = LIMITES.includes(Number(req.query.limit)) ? Number(req.query.limit) : 20;
  const page = Math.max(1, Math.floor(Number(req.query.page)) || 1);
  return { page, limit, offset: (page - 1) * limit };
}

export function pagina<T>(data: T[], total: number, page: number, limit: number) {
  return { data, page, limit, total, totalPages: Math.max(1, Math.ceil(total / limit)) };
}
