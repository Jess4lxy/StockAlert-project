<script setup lang="ts" generic="V extends string | number">
// Selector con panel propio (no el <select> nativo): se abre con clic o con
// el teclado, se navega con flechas, Enter elige y Escape cierra.
import { computed, nextTick, onBeforeUnmount, onMounted, ref } from 'vue';
import AppIcon from './AppIcon.vue';
import type { Opcion } from './types';

const props = defineProps<{ id?: string; options: Opcion<V>[]; placeholder?: string }>();
const modelo = defineModel<V>({ required: true });

const abierto = ref(false);
const haciaArriba = ref(false);
const activo = ref(0);
const raiz = ref<HTMLElement | null>(null);
const lista = ref<HTMLElement | null>(null);

const seleccionada = computed(() => props.options.find((o) => o.value === modelo.value));

function abrir() {
  // Si no cabe el panel (máx. 256 px) debajo del campo, se abre hacia arriba
  const caja = raiz.value?.getBoundingClientRect();
  haciaArriba.value = !!caja && window.innerHeight - caja.bottom < 264 && caja.top > 264;
  abierto.value = true;
  activo.value = Math.max(0, props.options.findIndex((o) => o.value === modelo.value));
  nextTick(desplazarAlActivo);
}

function cerrar() {
  abierto.value = false;
}

function elegir(opcion: Opcion<V>) {
  modelo.value = opcion.value;
  cerrar();
}

function desplazarAlActivo() {
  lista.value?.children[activo.value]?.scrollIntoView({ block: 'nearest' });
}

function teclado(e: KeyboardEvent) {
  if (!abierto.value) {
    if (['ArrowDown', 'ArrowUp', 'Enter', ' '].includes(e.key)) {
      e.preventDefault();
      abrir();
    }
    return;
  }
  if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
    e.preventDefault();
    const paso = e.key === 'ArrowDown' ? 1 : -1;
    activo.value = (activo.value + paso + props.options.length) % props.options.length;
    desplazarAlActivo();
  } else if (e.key === 'Enter' || e.key === ' ') {
    e.preventDefault();
    elegir(props.options[activo.value]);
  } else if (e.key === 'Escape' || e.key === 'Tab') {
    cerrar();
  }
}

function clicFuera(e: MouseEvent) {
  if (raiz.value && !raiz.value.contains(e.target as Node)) cerrar();
}
onMounted(() => document.addEventListener('mousedown', clicFuera));
onBeforeUnmount(() => document.removeEventListener('mousedown', clicFuera));
</script>

<template>
  <div ref="raiz" class="relative">
    <button
      :id="id"
      type="button"
      role="combobox"
      aria-haspopup="listbox"
      :aria-expanded="abierto"
      class="flex h-[43px] w-full items-center justify-between gap-2 rounded-lg border bg-white px-3 text-left text-sm font-medium text-texto focus:outline-none"
      :class="abierto ? 'border-marino ring-2 ring-marino/15' : 'border-borde focus:border-marino focus:ring-2 focus:ring-marino/15'"
      @click="abierto ? cerrar() : abrir()"
      @keydown="teclado"
    >
      <span class="truncate" :class="{ 'text-texto-suave/70': !seleccionada }">
        {{ seleccionada?.label ?? placeholder ?? 'Seleccionar' }}
      </span>
      <AppIcon name="expand_more" class="text-texto-suave transition-transform" :class="{ 'rotate-180': abierto }" />
    </button>

    <ul
      v-if="abierto"
      ref="lista"
      role="listbox"
      class="absolute z-30 max-h-64 w-full min-w-max overflow-auto rounded-lg border border-slate-200 bg-white py-1 shadow-lg"
      :class="haciaArriba ? 'bottom-full mb-1' : 'top-full mt-1'"
    >
      <li
        v-for="(opcion, i) in options"
        :key="String(opcion.value)"
        role="option"
        :aria-selected="opcion.value === modelo"
        class="flex min-h-11 cursor-pointer items-center justify-between gap-3 px-3 text-sm font-medium"
        :class="[
          i === activo ? 'bg-marino-10' : '',
          opcion.value === modelo ? 'text-marino' : 'text-texto',
        ]"
        @mouseenter="activo = i"
        @mousedown.prevent="elegir(opcion)"
      >
        {{ opcion.label }}
        <AppIcon v-if="opcion.value === modelo" name="check" :size="18" />
      </li>
    </ul>
  </div>
</template>
