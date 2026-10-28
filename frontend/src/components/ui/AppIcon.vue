<script setup lang="ts">
// Ícono de Material Symbols (Outlined). Nombres en https://fonts.google.com/icons
withDefaults(defineProps<{ name: string; size?: number }>(), { size: 20 });
</script>

<template>
  <span
    class="material-symbols-outlined shrink-0 select-none leading-none"
    :style="{ fontSize: `${size}px`, width: `${size}px`, height: `${size}px` }"
    aria-hidden="true"
  >
    {{ name }}
  </span>
</template>
