<script setup lang="ts">
// Avisos flotantes de la PWA: lista para usar sin conexión, actualización disponible
// y, en iOS, instrucciones para instalar (Safari no ofrece botón de instalación).
import { AppIcon } from '@/components/ui';
import { usePwa } from '@/pwa/usePwa';

const { sugerirIOS, listaSinConexion, hayActualizacion, actualizar, descartarListaSinConexion, descartarActualizacion } = usePwa();
</script>

<template>
  <div
    class="pointer-events-none fixed inset-x-0 bottom-0 z-50 flex flex-col items-center gap-2 px-4"
    style="padding-bottom: max(1rem, env(safe-area-inset-bottom))"
  >
    <div
      v-if="hayActualizacion"
      class="pointer-events-auto flex w-full max-w-md items-center gap-3 rounded-lg bg-marino p-3 text-white shadow-lg"
      role="status"
    >
      <AppIcon name="refresh" :size="22" />
      <p class="flex-1 text-sm">Hay una versión nueva de StockAlert.</p>
      <button type="button" class="rounded-lg bg-naranja px-3 py-1.5 text-sm font-semibold" @click="actualizar">Actualizar</button>
      <button type="button" class="rounded-full p-1 hover:bg-white/10" aria-label="Cerrar aviso" @click="descartarActualizacion">
        <AppIcon name="close" :size="18" />
      </button>
    </div>

    <div
      v-if="listaSinConexion"
      class="pointer-events-auto flex w-full max-w-md items-center gap-3 rounded-lg bg-exito p-3 text-white shadow-lg"
      role="status"
    >
      <AppIcon name="check_circle" :size="22" />
      <p class="flex-1 text-sm">Listo: StockAlert ya funciona sin conexión a Internet.</p>
      <button type="button" class="rounded-full p-1 hover:bg-white/10" aria-label="Cerrar aviso" @click="descartarListaSinConexion">
        <AppIcon name="close" :size="18" />
      </button>
    </div>

    <div v-if="sugerirIOS" class="pointer-events-auto flex w-full max-w-md items-center gap-3 rounded-lg bg-white p-3 text-texto shadow-lg ring-1 ring-slate-200">
      <AppIcon name="ios_share" :size="22" class="text-marino" />
      <p class="text-sm">Para instalar: toca <strong>Compartir</strong> y luego <strong>Agregar a pantalla de inicio</strong>.</p>
    </div>
  </div>
</template>
