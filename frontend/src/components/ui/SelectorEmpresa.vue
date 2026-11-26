<script setup lang="ts">
// Selector de empresa de la barra superior. Usa el <select> nativo: en el celular abre la
// lista del sistema. El valor cambia solo cuando la sesión ya abrió la otra empresa.
import { ref, watch } from 'vue';
import AppIcon from './AppIcon.vue';
import type { Opcion } from './types';

const props = defineProps<{ options: Opcion<number>[]; value: number; disabled?: boolean }>();
const emit = defineEmits<{ change: [id: number] }>();

const campo = ref<HTMLSelectElement | null>(null);
function alCambiar(e: Event) {
  const id = Number((e.target as HTMLSelectElement).value);
  // Se queda en la empresa abierta hasta que el cambio se complete (puede cancelarse o fallar)
  if (campo.value) campo.value.value = String(props.value);
  emit('change', id);
}
watch(
  () => props.value,
  (v) => campo.value && (campo.value.value = String(v)),
  { flush: 'post' },
);
</script>

<template>
  <div class="relative">
    <AppIcon name="business" :size="18" class="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-white/80" />
    <select
      ref="campo"
      :value="value"
      :disabled="disabled"
      aria-label="Cambiar de empresa"
      class="h-9 w-full cursor-pointer appearance-none truncate rounded-lg border border-white/30 bg-white/10 pr-9 pl-9 text-sm font-medium text-white hover:bg-white/15 focus:ring-2 focus:ring-white/40 focus:outline-none disabled:opacity-60"
      @change="alCambiar"
    >
      <option v-for="o in options" :key="o.value" :value="o.value" class="bg-white text-texto">{{ o.label }}</option>
    </select>
    <AppIcon name="expand_more" :size="18" class="pointer-events-none absolute top-1/2 right-3 -translate-y-1/2 text-white/80" />
  </div>
</template>
