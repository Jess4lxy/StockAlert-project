<script setup lang="ts">
import AppIcon from './AppIcon.vue';

defineProps<{
  id?: string;
  type?: string;
  placeholder?: string;
  icon?: string;
  autocomplete?: string;
  maxlength?: number;
  /** Teclado en móvil: numeric, decimal… */
  inputmode?: 'text' | 'numeric' | 'decimal';
  /** id de un <datalist> con sugerencias */
  list?: string;
  /** Marca el campo con borde rojo (error de validación) */
  invalid?: boolean;
}>();
const modelo = defineModel<string>({ default: '' });
</script>

<template>
  <div class="relative">
    <AppIcon v-if="icon" :name="icon" class="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-texto-suave" />
    <input
      :id="id"
      v-model="modelo"
      :type="type ?? 'text'"
      :placeholder="placeholder"
      :autocomplete="autocomplete"
      :maxlength="maxlength"
      :inputmode="inputmode"
      :list="list"
      :aria-invalid="invalid || undefined"
      class="h-[43px] w-full rounded-lg border bg-white px-3 text-sm text-texto placeholder:text-texto-suave/70 focus:ring-2 focus:outline-none"
      :class="[
        { 'pl-10': icon, 'pr-11': $slots.sufijo },
        invalid ? 'border-error focus:border-error focus:ring-error/15' : 'border-borde focus:border-marino focus:ring-marino/15',
      ]"
    />
    <!-- Acción a la derecha del campo (p. ej. mostrar la contraseña) -->
    <div v-if="$slots.sufijo" class="absolute inset-y-0 right-1 flex items-center">
      <slot name="sufijo" />
    </div>
  </div>
</template>
