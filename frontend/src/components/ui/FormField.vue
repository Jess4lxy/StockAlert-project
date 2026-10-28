<script setup lang="ts">
// Etiqueta + control. El control se pasa en el slot y recibe el mismo `id`.
defineProps<{ label: string; id: string }>();
</script>

<template>
  <div class="flex min-w-0 flex-col gap-1">
    <label :for="id" class="text-xs font-semibold text-texto-suave">{{ label }}</label>
    <slot />
  </div>
</template>
