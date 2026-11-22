<script setup lang="ts">
// Etiqueta + control. El control se pasa en el slot y recibe el mismo `id`.
// `error` muestra el mensaje de validación debajo del campo.
defineProps<{ label: string; id: string; error?: string }>();
</script>

<template>
  <div class="flex min-w-0 flex-col gap-1">
    <label :for="id" class="text-xs font-semibold text-texto-suave">{{ label }}</label>
    <slot />
    <p v-if="error" :id="`${id}-error`" class="text-xs text-error" role="alert">{{ error }}</p>
  </div>
</template>
