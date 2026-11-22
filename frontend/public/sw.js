/* StockAlert - Service Worker
 *
 * Estrategia:
 *  1. INSTALL   -> precachea el "app shell" (HTML, JS, CSS, fuentes, iconos y manifest).
 *                  La lista PRECACHE y BUILD las escribe vite.config.ts al compilar.
 *  2. ACTIVATE  -> borra cachés de versiones anteriores y toma el control de las pestañas.
 *  3. FETCH     -> solo peticiones GET:
 *      - API (/api/...): red primero y se guarda la respuesta; sin conexión responde con la
 *        última guardada. La consulta que nunca se hizo falla y la pantalla lo explica.
 *      - Navegación (HTML): red primero; si no hay conexión, responde con el index.html guardado.
 *      - Resto del mismo origen (JS, CSS, imágenes, fuentes): caché primero; si falta, red y se guarda.
 *
 * Al iniciar sesión, la app pide guardar las consultas iniciales de cada sección (mensaje
 * GUARDAR_DATOS, con el token), así dashboard, productos, movimientos y alertas abren sin
 * Internet. Las rutas de sesión (/api/auth/...) nunca se guardan, y al cerrar sesión la app
 * borra la caché de datos para que otra cuenta en el mismo dispositivo no los vea.
 *
 * Una versión nueva queda "en espera" hasta que el usuario pulse "Actualizar" en la app
 * (mensaje SKIP_WAITING), así nunca se cambia el código en medio de una sesión.
 */

const BUILD = 'dev';
const CACHE = `stockalert-${BUILD}`;
const PRECACHE = [];
// Los datos no dependen de la versión del código: sobreviven a las actualizaciones
const CACHE_DATOS = 'stockalert-datos';

// Las rutas se resuelven contra el scope del SW: sirve en la raíz o en una subcarpeta.
const aUrl = (ruta) => new URL(ruta, self.registration.scope).href;

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE).then((cache) => cache.addAll(PRECACHE.map(aUrl))),
  );
  // No se llama a skipWaiting() aquí: la versión nueva espera a que el usuario acepte.
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const nombres = await caches.keys();
      await Promise.all(
        nombres.filter((n) => n.startsWith('stockalert-') && n !== CACHE && n !== CACHE_DATOS).map((n) => caches.delete(n)),
      );
      await self.clients.claim();
    })(),
  );
});

self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') self.skipWaiting();
  if (event.data && event.data.type === 'GUARDAR_DATOS') event.waitUntil(guardarDatos(event.data.urls, event.data.token));
});

async function guardarDatos(urls, token) {
  const cache = await caches.open(CACHE_DATOS);
  await Promise.all(
    urls.map(async (url) => {
      try {
        const respuesta = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
        if (respuesta.ok) await cache.put(url, respuesta);
      } catch {
        // Sin red o sin API: se conserva lo que ya estaba guardado
      }
    }),
  );
}

async function redPrimero(request) {
  const cache = await caches.open(CACHE_DATOS);
  try {
    const respuesta = await fetch(request);
    if (respuesta.ok) await cache.put(request, respuesta.clone());
    return respuesta;
  } catch {
    return (await cache.match(request)) || Response.error();
  }
}

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);

  // La API puede estar en otro origen (VITE_API_URL), por eso se revisa antes
  if (url.pathname.startsWith('/api/')) {
    // Sesión y documentación: siempre a la red, sin guardar
    if (url.pathname.startsWith('/api/auth/') || url.pathname.startsWith('/api/docs') || url.pathname === '/api/openapi.json') return;
    event.respondWith(redPrimero(request));
    return;
  }

  if (url.origin !== self.location.origin) return;

  // Navegación: intenta la red para tener siempre el HTML más reciente; sin conexión usa el guardado
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request).catch(async () => {
        const cache = await caches.open(CACHE);
        return (await cache.match(aUrl('index.html'))) || (await cache.match(aUrl('./'))) || Response.error();
      }),
    );
    return;
  }

  // Recursos estáticos: caché primero
  event.respondWith(
    (async () => {
      const cache = await caches.open(CACHE);
      const guardado = await cache.match(request);
      if (guardado) return guardado;
      try {
        const respuesta = await fetch(request);
        if (respuesta.ok && respuesta.type === 'basic') cache.put(request, respuesta.clone());
        return respuesta;
      } catch {
        return Response.error();
      }
    })(),
  );
});
