<script setup lang="ts">
import AppIcon from './AppIcon.vue';

defineProps<{ id?: string; type?: string; placeholder?: string; icon?: string }>();
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
      class="h-[43px] w-full rounded-lg border border-borde bg-white px-3 text-sm text-texto placeholder:text-texto-suave/70 focus:border-marino focus:ring-2 focus:ring-marino/15 focus:outline-none"
      :class="{ 'pl-10': icon }"
    />
  </div>
</template>
