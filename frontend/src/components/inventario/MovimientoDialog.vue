<script setup lang="ts">
// Registro de una entrada, salida o ajuste. El producto se elige con el escáner, por
// nombre o ya viene elegido. Sin conexión queda en la cola del dispositivo.
import { computed, reactive, ref, watch } from 'vue';
import { mensajeDeError, type TipoMovimiento } from '@/api';
import { BaseButton, BaseDialog, FormField, SelectInput, TextInput } from '@/components/ui';
import { buscarLocal, ejecutar, productoPorCodigo, type ProductoLocal, type Resultado } from '@/datos/inventario';
import EscanerDialog from './EscanerDialog.vue';

const abierto = defineModel<boolean>('open', { required: true });
const props = defineProps<{ producto: ProductoLocal | null }>();
const emit = defineEmits<{ guardado: [nombre: string, resultado: Resultado] }>();

const elegido = ref<ProductoLocal | null>(null);
const busqueda = ref('');
const opciones = ref<ProductoLocal[]>([]);
const form = reactive({ tipo: 'salida' as TipoMovimiento, cantidad: '', observaciones: '' });
const errores = reactive({ producto: '', cantidad: '' });
const escaner = ref(false);
const guardando = ref(false);
const error = ref('');

const TIPOS = [
  { value: 'salida' as const, label: 'Salida: venta o consumo' },
  { value: 'entrada' as const, label: 'Entrada: compra o devolución' },
  { value: 'ajuste' as const, label: 'Ajuste: corrige el conteo (+ o −)' },
];

let intentado = false;
watch([form, elegido], () => intentado && validar());

watch(abierto, (valor) => {
  if (!valor) return;
  intentado = false;
  elegido.value = props.producto;
  busqueda.value = '';
  opciones.value = [];
  error.value = '';
  Object.assign(errores, { producto: '', cantidad: '' });
  Object.assign(form, { tipo: 'salida', cantidad: '', observaciones: '' });
});

watch(busqueda, async (q) => {
  if (!q.trim()) return (opciones.value = []);
  const r = await buscarLocal({ q, estado: '', categoria: '', page: 1, limit: 6 }).catch(() => null);
  if (q === busqueda.value) opciones.value = r?.data ?? [];
});

async function porCodigo(codigo: string) {
  const p = await productoPorCodigo(codigo).catch(() => null);
  errores.producto = p ? '' : `Ningún producto activo tiene el código ${codigo}`;
  if (p) elegido.value = p;
}

const cantidad = computed(() => (/^-?\d{1,7}$/.test(form.cantidad.trim()) ? Number(form.cantidad) : NaN));
const resultante = computed(() => {
  if (!elegido.value || !cantidad.value) return null;
  return elegido.value.stock_actual + (form.tipo === 'salida' ? -cantidad.value : cantidad.value);
});

function validar(): boolean {
  errores.producto = elegido.value ? '' : 'Elige un producto o escanea su código';
  errores.cantidad =
    !cantidad.value || (form.tipo !== 'ajuste' && cantidad.value < 0)
      ? form.tipo === 'ajuste'
        ? 'Escribe un entero distinto de 0; negativo si resta'
        : 'Escribe un entero mayor que 0'
      : resultante.value !== null && resultante.value < 0
        ? `No alcanza: hay ${elegido.value!.stock_actual}`
        : '';
  return !errores.producto && !errores.cantidad;
}

async function guardar() {
  intentado = true;
  if (!validar()) return;
  guardando.value = true;
  error.value = '';
  const p = elegido.value!;
  try {
    const r = await ejecutar({
      tipo: 'movimiento',
      producto: { id: p.id_producto || null, local: p.id_producto ? null : p.clave.replace('local-', '') },
      nombreProducto: p.nombre,
      movimiento: {
        tipo_movimiento: form.tipo,
        cantidad: cantidad.value,
        ...(form.observaciones.trim() ? { observaciones: form.observaciones.trim() } : {}),
      },
    });
    abierto.value = false;
    emit('guardado', p.nombre, r);
  } catch (e) {
    error.value = mensajeDeError(e);
  } finally {
    guardando.value = false;
  }
}
</script>

<template>
  <BaseDialog v-model:open="abierto" title="Registrar movimiento" subtitle="El stock se actualiza al guardarlo.">
    <form id="form-movimiento" novalidate class="flex flex-col gap-4" @submit.prevent="guardar">
      <div v-if="elegido" class="flex items-center justify-between gap-3 rounded-lg bg-marino-10 p-3">
        <div class="min-w-0">
          <p class="truncate font-semibold text-marino">{{ elegido.nombre }}</p>
          <p class="text-sm text-texto">Stock: {{ elegido.stock_actual }} · mínimo {{ elegido.stock_minimo }}</p>
        </div>
        <BaseButton v-if="!producto" variant="ghost" class="!h-9 !px-3 !text-sm" @click="elegido = null">Cambiar</BaseButton>
      </div>
      <template v-else>
        <FormField id="movimiento-producto" label="Producto" :error="errores.producto">
          <TextInput id="movimiento-producto" v-model="busqueda" icon="search" placeholder="Busca por nombre o código" autocomplete="off" :invalid="!!errores.producto" />
        </FormField>
        <ul v-if="opciones.length" class="-mt-2 overflow-hidden rounded-lg border border-slate-200">
          <li v-for="p in opciones" :key="p.clave" class="border-b border-slate-100 last:border-0">
            <button type="button" class="flex w-full justify-between gap-3 px-3 py-2.5 text-left text-sm hover:bg-marino-10" @click="elegido = p">
              <span class="truncate font-medium text-marino">{{ p.nombre }}</span>
              <span class="shrink-0 text-texto-suave">{{ p.stock_actual }} en stock</span>
            </button>
          </li>
        </ul>
        <p v-else-if="busqueda.trim()" class="-mt-2 text-sm text-texto-suave">Ningún producto activo coincide.</p>
        <BaseButton variant="outline" icon="barcode" @click="escaner = true">Escanear código</BaseButton>
      </template>

      <FormField id="movimiento-tipo" label="Tipo">
        <SelectInput id="movimiento-tipo" v-model="form.tipo" :options="TIPOS" />
      </FormField>
      <FormField id="movimiento-cantidad" label="Cantidad" :error="errores.cantidad">
        <!-- El teclado numérico de iOS no tiene signo: en un ajuste se usa el normal -->
        <TextInput id="movimiento-cantidad" v-model="form.cantidad" :inputmode="form.tipo === 'ajuste' ? 'text' : 'numeric'" placeholder="Ej. 5" :maxlength="8" :invalid="!!errores.cantidad" />
      </FormField>
      <p v-if="resultante !== null && resultante >= 0" class="-mt-2 text-sm text-texto-suave">
        Stock después del movimiento: <strong class="text-texto">{{ resultante }}</strong>
        <template v-if="resultante < elegido!.stock_minimo"> · quedará bajo su mínimo</template>
      </p>
      <FormField id="movimiento-observaciones" label="Observaciones (opcional)">
        <TextInput id="movimiento-observaciones" v-model="form.observaciones" placeholder="Ej. Venta de mostrador" :maxlength="500" />
      </FormField>
      <p v-if="error" class="rounded-lg bg-error-10 p-3 text-sm text-error" role="alert">{{ error }}</p>
    </form>
    <template #acciones>
      <BaseButton variant="outline" @click="abierto = false">Cancelar</BaseButton>
      <BaseButton type="submit" form="form-movimiento" :loading="guardando">Registrar</BaseButton>
    </template>
  </BaseDialog>
  <EscanerDialog v-model:open="escaner" @leido="porCodigo" />
</template>
