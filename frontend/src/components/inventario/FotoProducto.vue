<script setup lang="ts">
// Miniatura del producto. La foto se pide con la sesión (no es una URL pública) y queda
// guardada en el dispositivo para verla sin conexión.
import { onBeforeUnmount, ref, watch } from 'vue';
import { AppIcon } from '@/components/ui';
import { urlDeFoto, type ProductoLocal } from '@/datos/inventario';

const props = defineProps<{ producto: ProductoLocal }>();
const url = ref<string | null>(null);
let vigente = true;

function liberar() {
  if (url.value) URL.revokeObjectURL(url.value);
  url.value = null;
}

watch(
  () => `${props.producto.clave}/${props.producto.foto_fecha}`,
  async (clave) => {
    const nueva = await urlDeFoto(props.producto).catch(() => null);
    // El producto cambió (o se quitó de la pantalla) mientras se leía la foto
    if (!vigente || clave !== `${props.producto.clave}/${props.producto.foto_fecha}`) {
      if (nueva) URL.revokeObjectURL(nueva);
      return;
    }
    liberar();
    url.value = nueva;
  },
  { immediate: true },
);
onBeforeUnmount(() => {
  vigente = false;
  liberar();
});
</script>

<template>
  <img v-if="url" :src="url" alt="" class="h-10 w-10 shrink-0 rounded-lg border border-slate-200 object-cover" />
  <span v-else class="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-marino-10 text-marino">
    <AppIcon name="inventory_2" :size="20" />
  </span>
</template>
