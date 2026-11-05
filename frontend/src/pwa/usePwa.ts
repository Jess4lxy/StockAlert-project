// Estado y acciones de la PWA, compartidos por toda la app:
//  - registro del Service Worker
//  - botón "Instalar" (evento beforeinstallprompt)
//  - indicador de conexión
//  - aviso de actualización disponible / lista para usar sin conexión
//  - guardado de las consultas iniciales de cada sección para abrirlas sin conexión

import { computed, ref } from 'vue';
import { urlsEsenciales } from '@/api';

// El evento no está en los tipos de TypeScript porque no es estándar en todos los navegadores
interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

const eventoInstalacion = ref<BeforeInstallPromptEvent | null>(null);
const enLinea = ref(typeof navigator === 'undefined' ? true : navigator.onLine);
const instalada = ref(false);
const listaSinConexion = ref(false);
const hayActualizacion = ref(false);

let registro: ServiceWorkerRegistration | null = null;
let iniciado = false;

const esModoApp = () =>
  window.matchMedia('(display-mode: standalone)').matches ||
  window.matchMedia('(display-mode: minimal-ui)').matches ||
  // Safari en iOS
  (navigator as Navigator & { standalone?: boolean }).standalone === true;

const esIOS = () => /iphone|ipad|ipod/i.test(navigator.userAgent);

/** Se llama una sola vez al arrancar la app (main.ts). */
export function iniciarPwa() {
  if (iniciado) return;
  iniciado = true;

  instalada.value = esModoApp();

  window.addEventListener('online', () => (enLinea.value = true));
  window.addEventListener('offline', () => (enLinea.value = false));

  // El navegador avisa que la app cumple los criterios de instalación; se guarda el evento
  // para lanzar el diálogo cuando el usuario pulse nuestro propio botón.
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    eventoInstalacion.value = e as BeforeInstallPromptEvent;
  });
  window.addEventListener('appinstalled', () => {
    instalada.value = true;
    eventoInstalacion.value = null;
  });

  registrarServiceWorker();
}

function registrarServiceWorker() {
  // Solo en producción (npm run build + npm run preview): en desarrollo Vite sirve
  // módulos sin compilar y no existe la lista de archivos a precachear.
  if (!import.meta.env.PROD || !('serviceWorker' in navigator)) return;

  navigator.serviceWorker
    .register(`${import.meta.env.BASE_URL}sw.js`)
    .then((reg) => {
      registro = reg;

      // Si ya había una versión en espera (p. ej. se recargó la página antes de aceptar)
      if (reg.waiting && navigator.serviceWorker.controller) hayActualizacion.value = true;

      reg.addEventListener('updatefound', () => {
        const nuevo = reg.installing;
        if (!nuevo) return;
        nuevo.addEventListener('statechange', () => {
          if (nuevo.state !== 'installed') return;
          // Con controlador previo = actualización; sin él = primera instalación
          if (navigator.serviceWorker.controller) hayActualizacion.value = true;
          else listaSinConexion.value = true;
        });
      });

      // Revisa si hay versión nueva cada hora mientras la app esté abierta
      setInterval(() => reg.update().catch(() => {}), 60 * 60 * 1000);
    })
    .catch((error) => console.error('No se pudo registrar el Service Worker:', error));

  navigator.serviceWorker.ready.then((reg) => {
    reg.active?.postMessage({ type: 'GUARDAR_DATOS', urls: urlsEsenciales() });
  });

  // Cuando la versión nueva toma el control (tras SKIP_WAITING) se recarga para usarla.
  // El primer cambio de controlador en una página sin SW previo es solo la instalación inicial.
  let controlado = !!navigator.serviceWorker.controller;
  let recargando = false;
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (!controlado) {
      controlado = true;
      return;
    }
    if (recargando) return;
    recargando = true;
    window.location.reload();
  });
}

export function usePwa() {
  const puedeInstalar = computed(() => !!eventoInstalacion.value && !instalada.value);
  // iOS no dispara beforeinstallprompt: se instala desde "Compartir > Agregar a pantalla de inicio"
  const sugerirIOS = computed(() => esIOS() && !instalada.value && !eventoInstalacion.value);

  async function instalar() {
    const evento = eventoInstalacion.value;
    if (!evento) return;
    await evento.prompt();
    const { outcome } = await evento.userChoice;
    // El evento solo sirve una vez
    eventoInstalacion.value = null;
    if (outcome === 'accepted') instalada.value = true;
  }

  function actualizar() {
    registro?.waiting?.postMessage({ type: 'SKIP_WAITING' });
  }

  return {
    enLinea,
    instalada,
    puedeInstalar,
    sugerirIOS,
    listaSinConexion,
    hayActualizacion,
    instalar,
    actualizar,
    descartarListaSinConexion: () => (listaSinConexion.value = false),
    descartarActualizacion: () => (hayActualizacion.value = false),
  };
}
