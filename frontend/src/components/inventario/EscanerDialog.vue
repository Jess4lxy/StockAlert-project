<script setup lang="ts">
// Lee un código de barras con la cámara. Si no hay cámara o permiso, se escribe a mano.
import { nextTick, onBeforeUnmount, ref, watch } from 'vue';
import { BaseButton, BaseDialog, FormField, TextInput } from '@/components/ui';
import { escanear } from '@/dispositivo/escaner';

const abierto = defineModel<boolean>('open', { required: true });
const emit = defineEmits<{ leido: [codigo: string] }>();

const video = ref<HTMLVideoElement | null>(null);
const manual = ref('');
const error = ref('');
let detener: (() => void) | null = null;
// Cada apertura tiene su número: si se cierra mientras la cámara arranca, se apaga al llegar
let apertura = 0;

function apagar() {
  apertura++;
  detener?.();
  detener = null;
}

function entregar(codigo: string) {
  abierto.value = false;
  emit('leido', codigo.trim());
}

watch(abierto, async (valor) => {
  if (!valor) return apagar();
  manual.value = '';
  error.value = '';
  const actual = ++apertura;
  await nextTick();
  try {
    const parar = await escanear(video.value!, entregar);
    if (actual === apertura) detener = parar;
    else parar();
  } catch (e) {
    if (actual === apertura) error.value = (e as Error).message;
  }
});
onBeforeUnmount(apagar);
</script>

<template>
  <BaseDialog v-model:open="abierto" title="Escanear código" subtitle="Apunta la cámara al código de barras del producto.">
    <div v-show="!error" class="relative overflow-hidden rounded-xl bg-slate-900">
      <video ref="video" class="aspect-video w-full object-cover" muted playsinline aria-label="Vista de la cámara" />
      <div class="pointer-events-none absolute inset-x-8 top-1/2 h-0.5 -translate-y-1/2 bg-naranja" />
    </div>
    <p v-if="error" class="rounded-lg bg-alerta-10 p-3 text-sm text-texto" role="alert">{{ error }}</p>
    <form id="form-codigo" class="mt-4" novalidate @submit.prevent="manual.trim() && entregar(manual)">
      <FormField id="codigo-manual" label="O escribe el código">
        <TextInput id="codigo-manual" v-model="manual" inputmode="numeric" placeholder="Ej. 7501234567893" autocomplete="off" :maxlength="64" />
      </FormField>
    </form>
    <template #acciones>
      <BaseButton variant="outline" @click="abierto = false">Cancelar</BaseButton>
      <BaseButton type="submit" form="form-codigo" :disabled="!manual.trim()">Usar código</BaseButton>
    </template>
  </BaseDialog>
</template>
