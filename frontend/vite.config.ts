import tailwindcss from '@tailwindcss/vite';
import vue from '@vitejs/plugin-vue';
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [vue(), tailwindcss()],
  // Lee VITE_API_URL del .env de la raíz del repositorio
  envDir: '..',
});
