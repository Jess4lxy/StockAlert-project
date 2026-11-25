<script setup lang="ts">
// Alta y edición de un producto, con código de barras (escáner) y foto (cámara). Sin
// conexión los cambios quedan en la cola del dispositivo.
import { reactive, ref, watch } from 'vue';
import { mensajeDeError } from '@/api';
import { AppIcon, BaseButton, BaseDialog, FormField, TextInput } from '@/components/ui';
import type { DatosProducto } from '@/datos/bd';
import { categoriasLocales, ejecutar, urlDeFoto, type ProductoLocal, type Resultado } from '@/datos/inventario';
import { comprimirFoto } from '@/dispositivo/foto';
import EscanerDialog from './EscanerDialog.vue';

const abierto = defineModel<boolean>('open', { required: true });
const props = defineProps<{ producto: ProductoLocal | null; codigo?: string }>();
const emit = defineEmits<{ guardado: [nombre: string, resultado: Resultado] }>();

const form = reactive({ nombre: '', codigo: '', categoria: '', precio: '', minimo: '', inicial: '', descripcion: '' });
const errores = reactive({ nombre: '', codigo: '', precio: '', minimo: '', inicial: '' });
const categorias = ref<string[]>([]);
const escaner = ref(false);
const guardando = ref(false);
const error = ref('');

// Foto: undefined = sin cambios, null = quitarla
let foto: { tipo: string; bytes: ArrayBuffer } | null | undefined;
const vistaFoto = ref<string | null>(null);
// El alta ya se envió pero la foto falló: al reintentar no se crea otra vez
let yaCreado: { id: number | null; local: string | null } | null = null;
let alertaDelAlta: Resultado['alerta'] = null;

function verFoto(url: string | null) {
  if (vistaFoto.value) URL.revokeObjectURL(vistaFoto.value);
  vistaFoto.value = url;
}

let intentado = false;
watch(form, () => intentado && validar());

watch(abierto, async (valor) => {
  if (!valor) return;
  const p = props.producto;
  intentado = false;
  yaCreado = null;
  foto = undefined;
  error.value = '';
  Object.assign(errores, { nombre: '', codigo: '', precio: '', minimo: '', inicial: '' });
  Object.assign(form, {
    nombre: p?.nombre ?? '',
    codigo: p?.codigo_barras ?? props.codigo ?? '',
    categoria: p?.categoria ?? '',
    precio: p ? String(p.precio) : '',
    minimo: p ? String(p.stock_minimo) : '',
    inicial: '',
    descripcion: p?.descripcion ?? '',
  });
  verFoto(null);
  categorias.value = await categoriasLocales().catch(() => []);
  if (p) verFoto(await urlDeFoto(p).catch(() => null));
});

const esEntero = (t: string) => /^\d{1,9}$/.test(t.trim());
const esPrecio = (t: string) => /^\d{1,9}(\.\d{1,2})?$/.test(t.trim());

function validar(): boolean {
  errores.nombre = form.nombre.trim() ? '' : 'Escribe el nombre del producto';
  errores.codigo = !form.codigo.trim() || /^[0-9A-Za-z._-]{4,64}$/.test(form.codigo.trim()) ? '' : 'De 4 a 64 letras, números, puntos o guiones';
  errores.precio = esPrecio(form.precio) ? '' : 'Escribe un precio válido, por ejemplo 25.50';
  errores.minimo = esEntero(form.minimo) ? '' : 'Escribe un número entero, 0 o mayor';
  errores.inicial = props.producto || !form.inicial.trim() || esEntero(form.inicial) ? '' : 'Escribe un número entero, 0 o mayor';
  return !Object.values(errores).some(Boolean);
}

async function elegirFoto(e: Event) {
  const entrada = e.target as HTMLInputElement;
  const archivo = entrada.files?.[0];
  entrada.value = '';
  if (!archivo) return;
  error.value = '';
  try {
    foto = await comprimirFoto(archivo);
    verFoto(URL.createObjectURL(new Blob([foto.bytes], { type: foto.tipo })));
  } catch (err) {
    error.value = (err as Error).message;
  }
}

function quitarFoto() {
  foto = props.producto?.foto_fecha ? null : undefined;
  verFoto(null);
}

// Solo los campos que cambiaron, para no pisar lo que otra persona haya editado
function cambios(p: ProductoLocal): DatosProducto {
  const d: DatosProducto = {};
  if (form.nombre.trim() !== p.nombre) d.nombre = form.nombre.trim();
  if ((form.codigo.trim() || null) !== p.codigo_barras) d.codigo_barras = form.codigo.trim() || null;
  if ((form.categoria.trim() || null) !== p.categoria) d.categoria = form.categoria.trim() || null;
  if ((form.descripcion.trim() || null) !== p.descripcion) d.descripcion = form.descripcion.trim() || null;
  if (Number(form.precio) !== p.precio) d.precio = Number(form.precio);
  if (Number(form.minimo) !== p.stock_minimo) d.stock_minimo = Number(form.minimo);
  return d;
}

async function guardar() {
  intentado = true;
  if (!validar()) return;
  guardando.value = true;
  error.value = '';
  const nombre = form.nombre.trim();
  const p = props.producto;
  let enviada = true;
  let alerta = alertaDelAlta;
  try {
    let referencia = yaCreado ?? (p ? { id: p.id_producto || null, local: p.id_producto ? null : p.clave.replace('local-', '') } : null);
    if (!referencia) {
      const r = await ejecutar({
        tipo: 'crear_producto',
        producto: { id: null, local: null },
        nombreProducto: nombre,
        producto_datos: {
          nombre,
          precio: Number(form.precio),
          stock_minimo: Number(form.minimo),
          stock_inicial: Number(form.inicial || 0),
          ...(form.codigo.trim() ? { codigo_barras: form.codigo.trim() } : {}),
          ...(form.categoria.trim() ? { categoria: form.categoria.trim() } : {}),
          ...(form.descripcion.trim() ? { descripcion: form.descripcion.trim() } : {}),
        },
      });
      enviada = r.enviada;
      alerta = alertaDelAlta = r.alerta;
      referencia = yaCreado = r.enviada ? r.operacion.producto : { id: null, local: r.operacion.clave };
    } else if (p) {
      const datos = cambios(p);
      if (Object.keys(datos).length) {
        const r = await ejecutar({ tipo: 'editar_producto', producto: referencia, nombreProducto: nombre, producto_datos: datos });
        enviada = r.enviada;
        alerta = r.alerta;
      }
    }
    if (foto !== undefined) {
      const r = await ejecutar({ tipo: 'foto_producto', producto: referencia, nombreProducto: nombre, foto });
      enviada = enviada && r.enviada;
    }
    abierto.value = false;
    emit('guardado', nombre, { enviada, alerta });
  } catch (e) {
    error.value = mensajeDeError(e);
  } finally {
    guardando.value = false;
  }
}
</script>

<template>
  <BaseDialog
    v-model:open="abierto"
    :title="producto ? 'Editar producto' : 'Nuevo producto'"
    :subtitle="producto ? 'El stock cambia solo con movimientos.' : 'El stock inicial se registra como una entrada.'"
    width="lg"
  >
    <form id="form-producto" novalidate class="grid grid-cols-1 gap-4 md:grid-cols-2" @submit.prevent="guardar">
      <div class="flex items-center gap-4 md:col-span-2">
        <img v-if="vistaFoto" :src="vistaFoto" alt="Foto del producto" class="h-24 w-24 rounded-xl border border-slate-200 object-cover" />
        <span v-else class="flex h-24 w-24 items-center justify-center rounded-xl bg-marino-10 text-marino"><AppIcon name="image" :size="32" /></span>
        <div class="flex flex-wrap gap-2">
          <label class="inline-flex h-[43px] cursor-pointer items-center gap-2 rounded-lg border-2 border-marino px-4 text-[15px] font-semibold text-marino focus-within:ring-2 focus-within:ring-marino/30 hover:bg-marino-10">
            <AppIcon name="camera" />
            {{ vistaFoto ? 'Cambiar foto' : 'Tomar foto' }}
            <!-- capture abre la cámara en el celular; en computadora permite elegir un archivo -->
            <input id="foto-producto" type="file" accept="image/*" capture="environment" class="sr-only" @change="elegirFoto" />
          </label>
          <BaseButton v-if="vistaFoto" variant="ghost" icon="delete" @click="quitarFoto">Quitar</BaseButton>
        </div>
      </div>

      <FormField id="producto-nombre" label="Nombre" :error="errores.nombre">
        <TextInput id="producto-nombre" v-model="form.nombre" placeholder="Ej. Cuaderno profesional" :maxlength="150" :invalid="!!errores.nombre" />
      </FormField>
      <FormField id="producto-codigo" label="Código de barras (opcional)" :error="errores.codigo">
        <TextInput id="producto-codigo" v-model="form.codigo" placeholder="Escanéalo o escríbelo" autocomplete="off" :maxlength="64" :invalid="!!errores.codigo">
          <template #sufijo>
            <button type="button" class="rounded-md p-2 text-marino hover:bg-marino-10" aria-label="Escanear código de barras" @click="escaner = true">
              <AppIcon name="barcode" :size="20" />
            </button>
          </template>
        </TextInput>
      </FormField>
      <FormField id="producto-categoria" label="Categoría (opcional)">
        <TextInput id="producto-categoria" v-model="form.categoria" list="lista-categorias" placeholder="Ej. Papelería" :maxlength="80" />
        <datalist id="lista-categorias"><option v-for="c in categorias" :key="c" :value="c" /></datalist>
      </FormField>
      <FormField id="producto-precio" label="Precio (MXN)" :error="errores.precio">
        <TextInput id="producto-precio" v-model="form.precio" inputmode="decimal" placeholder="0.00" :maxlength="12" :invalid="!!errores.precio" />
      </FormField>
      <FormField id="producto-minimo" label="Stock mínimo" :error="errores.minimo">
        <TextInput id="producto-minimo" v-model="form.minimo" inputmode="numeric" placeholder="Ej. 10" :maxlength="9" :invalid="!!errores.minimo" />
      </FormField>
      <FormField v-if="!producto" id="producto-inicial" label="Stock inicial" :error="errores.inicial">
        <TextInput id="producto-inicial" v-model="form.inicial" inputmode="numeric" placeholder="0" :maxlength="9" :invalid="!!errores.inicial" />
      </FormField>
      <FormField id="producto-descripcion" label="Descripción (opcional)" class="md:col-span-2">
        <TextInput id="producto-descripcion" v-model="form.descripcion" placeholder="Presentación, marca, proveedor…" :maxlength="2000" />
      </FormField>
      <p v-if="error" class="rounded-lg bg-error-10 p-3 text-sm text-error md:col-span-2" role="alert">{{ error }}</p>
    </form>
    <template #acciones>
      <BaseButton variant="outline" @click="abierto = false">Cancelar</BaseButton>
      <BaseButton type="submit" form="form-producto" :loading="guardando">{{ producto ? 'Guardar cambios' : 'Crear producto' }}</BaseButton>
    </template>
  </BaseDialog>
  <EscanerDialog v-model:open="escaner" @leido="(c) => (form.codigo = c)" />
</template>
