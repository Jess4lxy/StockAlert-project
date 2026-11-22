// Sesión del usuario, compartida por toda la app. El token se guarda en el
// dispositivo para no pedir la contraseña cada vez que se abre la app; dura 12 h
// (lo decide la API) y al expirar se vuelve a la pantalla de inicio de sesión.

import { computed, ref } from 'vue';
import { api, configurarSesion, type Sesion, type UsuarioSesion } from '@/api';

const CLAVE = 'stockalert-sesion';
// Respuestas de la API que guarda el Service Worker (ver public/sw.js)
const CACHE_DATOS = 'stockalert-datos';

function leerGuardada(): Sesion | null {
  try {
    const guardada = JSON.parse(localStorage.getItem(CLAVE) ?? 'null') as Sesion | null;
    return guardada?.token && guardada.usuario ? guardada : null;
  } catch {
    return null;
  }
}

const actual = ref<Sesion | null>(leerGuardada());
// Motivo por el que se cerró la sesión sin que el usuario lo pidiera (se muestra en el login)
const aviso = ref('');

function guardar(sesion: Sesion | null) {
  actual.value = sesion;
  configurarSesion(sesion?.token ?? null);
  try {
    if (sesion) localStorage.setItem(CLAVE, JSON.stringify(sesion));
    else localStorage.removeItem(CLAVE);
  } catch {
    // Navegación privada o almacenamiento bloqueado: la sesión dura lo que la pestaña
  }
}

async function cerrarSesion(motivo = '') {
  aviso.value = motivo;
  guardar(null);
  // Los datos guardados para usar sin conexión son de esta cuenta: no deben verlos otras
  await caches?.delete(CACHE_DATOS).catch(() => {});
}

configurarSesion(actual.value?.token ?? null, () => {
  void cerrarSesion('Tu sesión expiró o tu cuenta fue desactivada. Inicia sesión de nuevo.');
});

async function iniciarSesion(correo: string, contrasena: string) {
  const sesion = await api.login(correo, contrasena);
  aviso.value = '';
  guardar(sesion);
}

async function registrar(datos: { empresa: string; nombre: string; correo: string; contrasena: string }) {
  const sesion = await api.registro(datos);
  aviso.value = '';
  guardar(sesion);
}

// Al abrir la app con una sesión guardada se confirma con la API (y se actualizan
// nombre, rol y empresa por si cambiaron). Sin conexión se conserva la guardada.
async function revisarSesion() {
  if (!actual.value) return;
  try {
    const usuario: UsuarioSesion = await api.yo();
    guardar({ token: actual.value.token, usuario });
  } catch {
    // Un 401 ya cerró la sesión (configurarSesion); otros errores no la cierran
  }
}

export function useSesion() {
  return {
    sesion: computed(() => actual.value),
    usuario: computed(() => actual.value?.usuario ?? null),
    aviso,
    iniciarSesion,
    registrar,
    cerrarSesion,
    revisarSesion,
  };
}

export const tokenActual = () => actual.value?.token ?? null;
