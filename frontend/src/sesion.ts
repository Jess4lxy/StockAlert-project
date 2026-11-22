// Sesión del usuario, compartida por toda la app.
//  - El token de acceso dura 15 min y vive solo en memoria (api.ts).
//  - El refresh token (30 días) está en una cookie httpOnly que JavaScript no puede leer;
//    api.ts lo usa para renovar el token de acceso cuando la API responde 401.
//  - En el dispositivo solo se guardan los datos del usuario, para mostrar quién tiene la
//    sesión y las pantallas guardadas aunque no haya conexión.

import { computed, ref } from 'vue';
import { api, configurarSesion, refrescarSesion, type Sesion, type UsuarioSesion } from '@/api';

const CLAVE = 'stockalert-sesion';
// Respuestas de la API que guarda el Service Worker (ver public/sw.js)
const CACHE_DATOS = 'stockalert-datos';

function leerGuardado(): UsuarioSesion | null {
  try {
    const guardado = JSON.parse(localStorage.getItem(CLAVE) ?? 'null') as { usuario?: UsuarioSesion } | null;
    return guardado?.usuario?.id_usuario ? guardado.usuario : null;
  } catch {
    return null;
  }
}

const usuarioActual = ref<UsuarioSesion | null>(leerGuardado());
const token = ref<string | null>(null);
// Motivo por el que se cerró la sesión sin que el usuario lo pidiera (se muestra en el login)
const aviso = ref('');

function guardar(sesion: Sesion) {
  usuarioActual.value = sesion.usuario;
  token.value = sesion.token;
  configurarSesion(sesion.token);
  try {
    localStorage.setItem(CLAVE, JSON.stringify({ usuario: sesion.usuario }));
  } catch {
    // Navegación privada o almacenamiento bloqueado: la sesión dura lo que la pestaña
  }
}

async function olvidar(motivo: string) {
  aviso.value = motivo;
  usuarioActual.value = null;
  token.value = null;
  configurarSesion(null);
  try {
    localStorage.removeItem(CLAVE);
  } catch {
    // sin almacenamiento
  }
  // Los datos guardados para usar sin conexión son de esta cuenta: no deben verlos otras
  await caches?.delete(CACHE_DATOS).catch(() => {});
}

configurarSesion(null, {
  alRenovar: guardar,
  alRechazar: () => void olvidar('Tu sesión expiró o tu cuenta fue desactivada. Inicia sesión de nuevo.'),
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

// Cerrar sesión: la API revoca el refresh token de este dispositivo y borra la cookie.
// Sin conexión se cierra igual en el dispositivo.
async function cerrarSesion() {
  await api.logout().catch(() => {});
  await olvidar('');
}

// Al abrir la app con un usuario guardado se pide un token de acceso con la cookie
// (también actualiza nombre, rol y empresa por si cambiaron). Sin conexión se conserva
// el usuario guardado y se muestran las pantallas que el Service Worker tenga guardadas.
async function revisarSesion() {
  if (!usuarioActual.value || token.value) return;
  try {
    await refrescarSesion();
  } catch {
    // Sin conexión: la sesión se renovará con la siguiente petición que llegue a la API
  }
}

export function useSesion() {
  return {
    usuario: computed(() => usuarioActual.value),
    token: computed(() => token.value),
    aviso,
    iniciarSesion,
    registrar,
    cerrarSesion,
    revisarSesion,
  };
}

export const tokenActual = () => token.value;
