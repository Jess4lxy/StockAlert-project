<script setup lang="ts">
// Ventana modal con título, contenido y acciones al pie. Se cierra con Escape,
// con la X o con clic fuera del panel. El foco entra al abrir y vuelve al cerrar.
import { nextTick, onBeforeUnmount, ref, watch } from 'vue';
import AppIcon from './AppIcon.vue';

const props = defineProps<{ title: string; subtitle?: string; width?: 'md' | 'lg' }>();
const abierto = defineModel<boolean>('open', { required: true });

const panel = ref<HTMLElement | null>(null);
let focoPrevio: HTMLElement | null = null;

function teclado(e: KeyboardEvent) {
  if (e.key === 'Escape') abierto.value = false;
}

watch(
  abierto,
  async (valor) => {
    if (valor) {
      focoPrevio = document.activeElement as HTMLElement | null;
      document.addEventListener('keydown', teclado);
      document.body.style.overflow = 'hidden';
      await nextTick();
      panel.value?.querySelector<HTMLElement>('input, button:not([aria-label="Cerrar"]), [tabindex]')?.focus();
    } else {
      document.removeEventListener('keydown', teclado);
      document.body.style.overflow = '';
      focoPrevio?.focus();
    }
  },
  { immediate: true },
);
onBeforeUnmount(() => {
  document.removeEventListener('keydown', teclado);
  document.body.style.overflow = '';
});

const ancho = { md: 'max-w-lg', lg: 'max-w-2xl' };
</script>

<template>
  <Teleport to="body">
    <div v-if="abierto" class="fixed inset-0 z-50 flex items-end justify-center bg-slate-900/40 sm:items-center sm:p-4" @mousedown.self="abierto = false">
      <div
        ref="panel"
        role="dialog"
        aria-modal="true"
        :aria-label="props.title"
        class="flex max-h-[92vh] w-full flex-col rounded-t-2xl bg-white shadow-xl sm:rounded-2xl"
        :class="ancho[props.width ?? 'md']"
      >
        <div class="flex items-start gap-3 border-b border-gray-100 px-5 pt-5 pb-4">
          <div class="min-w-0 flex-1">
            <h2 class="text-xl font-semibold text-marino">{{ title }}</h2>
            <p v-if="subtitle" class="mt-1 text-sm text-texto-suave">{{ subtitle }}</p>
          </div>
          <button type="button" aria-label="Cerrar" class="rounded-full p-1.5 text-texto-suave hover:bg-marino-10 hover:text-marino" @click="abierto = false">
            <AppIcon name="close" :size="20" />
          </button>
        </div>
        <div class="overflow-y-auto px-5 py-4">
          <slot />
        </div>
        <div v-if="$slots.acciones" class="flex flex-col-reverse gap-2 border-t border-gray-100 px-5 py-4 sm:flex-row sm:justify-end" style="padding-bottom: max(1rem, env(safe-area-inset-bottom))">
          <slot name="acciones" />
        </div>
      </div>
    </div>
  </Teleport>
</template>
