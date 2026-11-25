// Notificaciones del sistema para las alertas de stock (Notification API + Service Worker).
// Son locales: la app avisa cuando detecta una alerta nueva estando abierta o en segundo
// plano. El aviso con la app cerrada lo da n8n por correo.

import { computed, ref } from 'vue';
import { api, type Alerta } from '@/api';
import { bd } from '@/datos/bd';

const soportadas = 'Notification' in window;
const permiso = ref<NotificationPermission>(soportadas ? Notification.permission : 'denied');

export function useNotificaciones() {
  return {
    soportadas,
    activas: computed(() => permiso.value === 'granted'),
    bloqueadas: computed(() => permiso.value === 'denied'),
    // El navegador solo permite pedir el permiso tras una acción del usuario
    async activar() {
      if (!soportadas) return;
      permiso.value = await Notification.requestPermission();
      if (permiso.value === 'granted') await mostrar('Avisos activados', 'StockAlert te avisará cuando un producto baje de su mínimo.', 'avisos');
    },
  };
}

async function mostrar(titulo: string, cuerpo: string, etiqueta: string) {
  if (!soportadas || Notification.permission !== 'granted') return;
  const opciones = { body: cuerpo, tag: etiqueta, icon: `${import.meta.env.BASE_URL}icons/icon-192.png`, data: { ruta: '#/alertas' } };
  // En Android solo se pueden mostrar desde el Service Worker
  const registro = await navigator.serviceWorker?.getRegistration();
  if (registro?.active) await registro.showNotification(titulo, opciones);
  else if (!/Android/i.test(navigator.userAgent)) new Notification(titulo, opciones);
}

const textoDe = (a: { producto?: string; tipo_alerta: string; stock_detectado: number }) =>
  a.tipo_alerta === 'agotado' ? `${a.producto} se agotó` : `${a.producto} está bajo su mínimo (quedan ${a.stock_detectado})`;

/** Alerta generada por una operación de este dispositivo */
export async function notificarAlerta(usuario: number, alerta: Alerta, nombre: string) {
  const ultima = Number(await bd.meta(usuario, 'ultima-alerta')) || 0;
  if (alerta.id_alerta > ultima) await bd.guardarMeta(usuario, 'ultima-alerta', String(alerta.id_alerta));
  await mostrar('Alerta de stock', textoDe({ ...alerta, producto: nombre }), `alerta-${alerta.id_alerta}`);
}

/** Revisa si hay alertas que este dispositivo no ha visto (p. ej., de una venta en otro) */
export async function revisarAlertas(usuario: number) {
  if (!navigator.onLine) return;
  const { data } = await api.alertas({ estado: 'pendiente', tipo: '', page: 1, limit: 20 });
  const anterior = await bd.meta(usuario, 'ultima-alerta');
  const mayor = Math.max(0, ...data.map((a) => a.id_alerta));
  if (mayor > Number(anterior)) await bd.guardarMeta(usuario, 'ultima-alerta', String(mayor));
  // La primera vez solo se toma nota: no se avisa de alertas antiguas
  if (anterior === null) return;
  const nuevas = data.filter((a) => a.id_alerta > Number(anterior));
  if (nuevas.length === 1) await mostrar('Alerta de stock', textoDe(nuevas[0]), `alerta-${nuevas[0].id_alerta}`);
  else if (nuevas.length > 1) await mostrar('Alertas de stock', `${nuevas.length} productos necesitan reponerse`, 'alertas');
}
