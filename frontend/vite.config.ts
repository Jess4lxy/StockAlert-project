import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, URL } from 'node:url';
import tailwindcss from '@tailwindcss/vite';
import vue from '@vitejs/plugin-vue';
import { defineConfig, type Plugin } from 'vite';

// Recorre dist/ y devuelve las rutas de todos sus archivos (con "/" como separador).
function listar(dir: string, base = dir): string[] {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const completa = path.join(dir, e.name);
    return e.isDirectory() ? listar(completa, base) : [path.relative(base, completa).split(path.sep).join('/')];
  });
}

// Al terminar el build, escribe en dist/sw.js la lista real de archivos a precachear
// (los nombres con hash de Vite solo se conocen después de compilar) y una versión de
// caché derivada del contenido: si cambia cualquier archivo, el navegador detecta un
// Service Worker nuevo y avisa al usuario que hay una actualización.
function precacheServiceWorker(): Plugin {
  let salida = '';
  return {
    name: 'stockalert-sw-precache',
    apply: 'build',
    configResolved(config) {
      salida = path.resolve(config.root, config.build.outDir);
    },
    closeBundle() {
      const swPath = path.join(salida, 'sw.js');
      if (!fs.existsSync(swPath)) return;
      const archivos = listar(salida).filter((f) => f !== 'sw.js' && !f.endsWith('.map')).sort();
      const huella = crypto.createHash('sha1');
      for (const f of archivos) huella.update(f).update(fs.readFileSync(path.join(salida, f)));
      const version = huella.digest('hex').slice(0, 10);
      const sw = fs
        .readFileSync(swPath, 'utf8')
        .replace('const PRECACHE = [];', `const PRECACHE = ${JSON.stringify(['./', ...archivos], null, 2)};`)
        .replace("const BUILD = 'dev';", `const BUILD = '${version}';`);
      fs.writeFileSync(swPath, sw);
      console.log(`\n[sw] ${archivos.length + 1} recursos en precache · versión ${version}`);
    },
  };
}

export default defineConfig({
  // Rutas relativas: la app funciona en la raíz de un dominio o en una subcarpeta
  base: './',
  plugins: [vue(), tailwindcss(), precacheServiceWorker()],
  preview: {
    // Permite abrir la versión compilada desde un túnel HTTPS de Cloudflare (la URL cambia en cada túnel)
    allowedHosts: ['.trycloudflare.com'],
    // Con VITE_API_URL=/api la API se sirve por el mismo dominio: basta un túnel y no se necesita CORS
    proxy: { '/api': 'http://localhost:3000' },
  },
  resolve: {
    alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
  },
  // Lee VITE_API_URL del .env de la raíz del repositorio
  envDir: '..',
});
