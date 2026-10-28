<script setup lang="ts">
import AppIcon from './AppIcon.vue';

withDefaults(
  defineProps<{
    variant?: 'primary' | 'outline' | 'ghost';
    type?: 'button' | 'submit';
    icon?: string;
    disabled?: boolean;
  }>(),
  { variant: 'primary', type: 'button' },
);

const VARIANTES = {
  primary: 'border-marino bg-marino text-white shadow-sm hover:border-marino-70 hover:bg-marino-70 hover:shadow',
  outline: 'border-marino bg-white text-marino hover:bg-marino-10 hover:border-marino-70 hover:text-marino-70',
  ghost: 'border-transparent bg-transparent text-marino hover:bg-marino-10',
};
</script>

<template>
  <button
    :type="type"
    :disabled="disabled"
    class="inline-flex h-[43px] items-center justify-center gap-2 rounded-lg border-2 px-5 text-[15px] font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-50"
    :class="VARIANTES[variant]"
  >
    <AppIcon v-if="icon" :name="icon" />
    <slot />
  </button>
</template>
