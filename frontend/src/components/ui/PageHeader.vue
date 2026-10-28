<script setup lang="ts">
defineProps<{ title: string; subtitle?: string }>();
</script>

<template>
  <header class="flex flex-wrap items-end justify-between gap-4 pt-3 pb-3">
    <div>
      <h1 class="text-3xl text-gray-600">{{ title }}</h1>
      <p v-if="subtitle" class="mt-1 text-sm text-texto-suave">{{ subtitle }}</p>
    </div>
    <div v-if="$slots.actions" class="flex flex-wrap gap-3">
      <slot name="actions" />
    </div>
  </header>
</template>
