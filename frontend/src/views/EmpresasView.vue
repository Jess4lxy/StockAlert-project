<script setup lang="ts">
// Administración de la plataforma: empresas registradas. Crear (con su administrador),
// renombrar y activar o desactivar. Desactivar una empresa impide que sus usuarios entren.
import { onMounted, reactive, ref, watch } from 'vue';
import { api, mensajeDeError, type Empresa, type Pagina } from '@/api';
import {
  BaseButton,
  BaseDialog,
  DataTable,
  FilterBar,
  FormField,
  PageHeader,
  SelectInput,
  StatusBadge,
  TablePagination,
  TextInput,
  type Columna,
} from '@/components/ui';

const emit = defineEmits<{ verUsuarios: [idEmpresa: number] }>();

const filtros = reactive({ q: '', estado: '', page: 1, limit: 20 });
const resultado = ref<Pagina<Empresa> | null>(null);
const cargando = ref(false);
const error = ref('');
const exito = ref('');

let controlador: AbortController | null = null;
async function cargar() {
  controlador?.abort();
  controlador = new AbortController();
  cargando.value = true;
  try {
    resultado.value = await api.empresas({ ...filtros }, controlador.signal);
    error.value = '';
  } catch (e) {
    if ((e as Error).name === 'AbortError') return;
    error.value = mensajeDeError(e);
  }
  cargando.value = false;
}

function reiniciar() {
  if (filtros.page === 1) cargar();
  else filtros.page = 1;
}
let espera: ReturnType<typeof setTimeout> | undefined;
watch(
  () => filtros.q,
  () => {
    clearTimeout(espera);
    espera = setTimeout(reiniciar, 300);
  },
);
watch(() => [filtros.estado, filtros.limit], reiniciar);
watch(() => filtros.page, cargar);
onMounted(cargar);

function avisar(mensaje: string) {
  exito.value = mensaje;
  setTimeout(() => (exito.value = ''), 4000);
}

// --- Nueva empresa -----------------------------------------------------------
const crearAbierto = ref(false);
const nueva = reactive({ nombre: '', conAdmin: true, adminNombre: '', adminCorreo: '', adminContrasena: '' });
const erroresNueva = reactive({ nombre: '', adminNombre: '', adminCorreo: '', adminContrasena: '' });
const guardando = ref(false);
const errorDialogo = ref('');

let intentadoNueva = false;
watch(nueva, () => intentadoNueva && validarNueva());

function abrirCrear() {
  intentadoNueva = false;
  Object.assign(nueva, { nombre: '', conAdmin: true, adminNombre: '', adminCorreo: '', adminContrasena: '' });
  Object.assign(erroresNueva, { nombre: '', adminNombre: '', adminCorreo: '', adminContrasena: '' });
  errorDialogo.value = '';
  crearAbierto.value = true;
}

function validarNueva(): boolean {
  erroresNueva.nombre = nueva.nombre.trim().length < 2 ? 'Escribe el nombre de la empresa (mínimo 2 caracteres)' : '';
  if (nueva.conAdmin) {
    erroresNueva.adminNombre = nueva.adminNombre.trim().length < 2 ? 'Escribe el nombre (mínimo 2 caracteres)' : '';
    erroresNueva.adminCorreo = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(nueva.adminCorreo.trim()) ? '' : 'Escribe un correo válido';
    // Puede ir vacía si el correo ya tiene cuenta: la API lo revisa
    erroresNueva.adminContrasena = nueva.adminContrasena && nueva.adminContrasena.length < 8 ? 'Usa al menos 8 caracteres' : '';
  } else {
    Object.assign(erroresNueva, { adminNombre: '', adminCorreo: '', adminContrasena: '' });
  }
  return !Object.values(erroresNueva).some(Boolean);
}

async function crear() {
  intentadoNueva = true;
  if (!validarNueva()) return;
  guardando.value = true;
  errorDialogo.value = '';
  try {
    const empresa = await api.crearEmpresa({
      nombre: nueva.nombre.trim(),
      ...(nueva.conAdmin
        ? { admin: { nombre: nueva.adminNombre.trim(), correo: nueva.adminCorreo.trim(), contrasena: nueva.adminContrasena || undefined } }
        : {}),
    });
    crearAbierto.value = false;
    avisar(`Empresa "${empresa.nombre}" creada${nueva.conAdmin ? ' con su administrador' : ''}.`);
    reiniciar();
  } catch (e) {
    errorDialogo.value = mensajeDeError(e);
  } finally {
    guardando.value = false;
  }
}

// --- Renombrar -----------------------------------------------------------------
const editarAbierto = ref(false);
const editando = ref<Empresa | null>(null);
const nombreEditado = ref('');
const errorNombre = ref('');

watch(nombreEditado, () => errorNombre.value && validarNombre());
const validarNombre = () => {
  errorNombre.value = nombreEditado.value.trim().length < 2 ? 'Escribe el nombre (mínimo 2 caracteres)' : '';
  return !errorNombre.value;
};

function abrirEditar(empresa: Empresa) {
  editando.value = empresa;
  nombreEditado.value = empresa.nombre;
  errorNombre.value = '';
  errorDialogo.value = '';
  editarAbierto.value = true;
}

async function guardarNombre() {
  if (!editando.value) return;
  if (!validarNombre()) return;
  guardando.value = true;
  try {
    await api.editarEmpresa(editando.value.id_empresa, { nombre: nombreEditado.value.trim() });
    editarAbierto.value = false;
    avisar('Nombre actualizado.');
    cargar();
  } catch (e) {
    errorDialogo.value = mensajeDeError(e);
  } finally {
    guardando.value = false;
  }
}

// --- Activar / desactivar ----------------------------------------------------
const confirmarAbierto = ref(false);
const porCambiar = ref<Empresa | null>(null);

function pedirCambioEstado(empresa: Empresa) {
  porCambiar.value = empresa;
  errorDialogo.value = '';
  confirmarAbierto.value = true;
}

async function cambiarEstado() {
  const empresa = porCambiar.value;
  if (!empresa) return;
  guardando.value = true;
  try {
    await api.editarEmpresa(empresa.id_empresa, { estado: !empresa.estado });
    confirmarAbierto.value = false;
    avisar(`Empresa "${empresa.nombre}" ${empresa.estado ? 'desactivada' : 'activada'}.`);
    cargar();
  } catch (e) {
    errorDialogo.value = mensajeDeError(e);
  } finally {
    guardando.value = false;
  }
}

const opcionesEstado = [
  { value: '', label: 'Todas' },
  { value: 'activa', label: 'Activas' },
  { value: 'inactiva', label: 'Inactivas' },
];

const columnas: Columna[] = [
  { key: 'nombre', label: 'Empresa' },
  { key: 'usuarios', label: 'Usuarios activos', align: 'right', class: 'tabular-nums' },
  { key: 'productos', label: 'Productos', align: 'right', class: 'tabular-nums' },
  { key: 'fecha_registro', label: 'Registro', class: 'whitespace-nowrap' },
  { key: 'estado', label: 'Estado' },
  { key: 'acciones', label: 'Acciones', align: 'right', class: 'whitespace-nowrap' },
];

const fecha = new Intl.DateTimeFormat('es-MX', { timeZone: 'America/Merida', dateStyle: 'medium' });
</script>

<template>
  <section>
    <PageHeader title="Empresas" subtitle="Negocios que usan StockAlert. Crea empresas con su administrador y actívalas o desactívalas.">
      <template #actions>
        <BaseButton icon="add" @click="abrirCrear">Nueva empresa</BaseButton>
      </template>
    </PageHeader>

    <FilterBar :columns="2">
      <FormField id="buscar-empresa" label="Empresa">
        <TextInput id="buscar-empresa" v-model="filtros.q" type="search" icon="search" placeholder="Buscar por nombre" />
      </FormField>
      <FormField id="estado-empresa" label="Estado">
        <SelectInput id="estado-empresa" v-model="filtros.estado" :options="opcionesEstado" />
      </FormField>
    </FilterBar>

    <p v-if="exito" class="mb-3 rounded-lg bg-exito-10 p-3 text-sm text-exito" role="status">{{ exito }}</p>
    <p v-if="error" class="mb-3 rounded-lg bg-error-10 p-3 text-sm text-error">{{ error }}</p>

    <DataTable :columns="columnas" :rows="resultado?.data ?? []" row-key="id_empresa" :loading="cargando" empty-text="No hay empresas con esos filtros.">
      <template #cell-nombre="{ row }">
        <span class="font-medium text-marino">{{ row.nombre }}</span>
      </template>
      <template #cell-fecha_registro="{ row }">{{ fecha.format(new Date(row.fecha_registro)) }}</template>
      <template #cell-estado="{ row }">
        <StatusBadge :tone="row.estado ? 'exito' : 'neutro'">{{ row.estado ? 'Activa' : 'Inactiva' }}</StatusBadge>
      </template>
      <template #cell-acciones="{ row }">
        <div class="flex justify-end gap-1">
          <BaseButton variant="ghost" icon="group" class="!h-9 !px-3 !text-sm" @click="emit('verUsuarios', row.id_empresa)">Usuarios</BaseButton>
          <BaseButton variant="ghost" icon="edit" class="!h-9 !px-3 !text-sm" @click="abrirEditar(row)">Renombrar</BaseButton>
          <BaseButton variant="ghost" class="!h-9 !px-3 !text-sm" @click="pedirCambioEstado(row)">
            {{ row.estado ? 'Desactivar' : 'Activar' }}
          </BaseButton>
        </div>
      </template>
    </DataTable>

    <TablePagination v-if="resultado" v-model:page="filtros.page" v-model:limit="filtros.limit" :total="resultado.total" class="mt-2" />

    <BaseDialog v-model:open="crearAbierto" title="Nueva empresa" subtitle="Registra un negocio y, si quieres, la cuenta de su administrador." width="lg">
      <form id="form-empresa" novalidate class="flex flex-col gap-5" @submit.prevent="crear">
        <FormField id="empresa-nombre" label="Nombre de la empresa" :error="erroresNueva.nombre">
          <TextInput id="empresa-nombre" v-model="nueva.nombre" placeholder="Ej. Abarrotes Don Pepe" :maxlength="150" :invalid="!!erroresNueva.nombre" />
        </FormField>

        <label class="flex items-center gap-2 text-sm font-medium text-texto">
          <input v-model="nueva.conAdmin" type="checkbox" class="h-4 w-4 accent-marino" />
          Crear también la cuenta de su administrador
        </label>

        <div v-if="nueva.conAdmin" class="grid grid-cols-1 gap-4 md:grid-cols-2">
          <FormField id="admin-nombre" label="Nombre del administrador" :error="erroresNueva.adminNombre">
            <TextInput id="admin-nombre" v-model="nueva.adminNombre" placeholder="Ej. José Pérez" :maxlength="100" :invalid="!!erroresNueva.adminNombre" />
          </FormField>
          <FormField id="admin-correo" label="Correo" :error="erroresNueva.adminCorreo">
            <TextInput id="admin-correo" v-model="nueva.adminCorreo" type="email" placeholder="nombre@negocio.com" autocomplete="off" :maxlength="150" :invalid="!!erroresNueva.adminCorreo" />
          </FormField>
          <FormField id="admin-contrasena" label="Contraseña inicial" :error="erroresNueva.adminContrasena">
            <TextInput id="admin-contrasena" v-model="nueva.adminContrasena" type="password" placeholder="Solo si es una cuenta nueva (mínimo 8)" autocomplete="new-password" :maxlength="128" :invalid="!!erroresNueva.adminContrasena" />
          </FormField>
          <p class="self-end pb-2 text-xs text-texto-suave">Si el correo ya tiene cuenta, se usa esa con su contraseña de siempre.</p>
        </div>
        <p v-if="errorDialogo" class="rounded-lg bg-error-10 p-3 text-sm text-error" role="alert">{{ errorDialogo }}</p>
      </form>
      <template #acciones>
        <BaseButton variant="outline" @click="crearAbierto = false">Cancelar</BaseButton>
        <BaseButton type="submit" form="form-empresa" :loading="guardando">Crear empresa</BaseButton>
      </template>
    </BaseDialog>

    <BaseDialog v-model:open="editarAbierto" title="Renombrar empresa">
      <form id="form-renombrar" novalidate class="flex flex-col gap-4" @submit.prevent="guardarNombre">
        <FormField id="empresa-renombrar" label="Nombre de la empresa" :error="errorNombre">
          <TextInput id="empresa-renombrar" v-model="nombreEditado" :maxlength="150" :invalid="!!errorNombre" />
        </FormField>
        <p v-if="errorDialogo" class="rounded-lg bg-error-10 p-3 text-sm text-error" role="alert">{{ errorDialogo }}</p>
      </form>
      <template #acciones>
        <BaseButton variant="outline" @click="editarAbierto = false">Cancelar</BaseButton>
        <BaseButton type="submit" form="form-renombrar" :loading="guardando">Guardar</BaseButton>
      </template>
    </BaseDialog>

    <BaseDialog v-model:open="confirmarAbierto" :title="porCambiar?.estado ? 'Desactivar empresa' : 'Activar empresa'">
      <p v-if="porCambiar?.estado" class="text-sm text-texto">
        Los usuarios de <strong>{{ porCambiar?.nombre }}</strong> no podrán iniciar sesión y sus sesiones abiertas se cerrarán.
        Sus datos se conservan y puedes volver a activarla cuando quieras.
      </p>
      <p v-else class="text-sm text-texto">Los usuarios activos de <strong>{{ porCambiar?.nombre }}</strong> podrán volver a iniciar sesión.</p>
      <p v-if="errorDialogo" class="mt-3 rounded-lg bg-error-10 p-3 text-sm text-error" role="alert">{{ errorDialogo }}</p>
      <template #acciones>
        <BaseButton variant="outline" @click="confirmarAbierto = false">Cancelar</BaseButton>
        <BaseButton :loading="guardando" @click="cambiarEstado">{{ porCambiar?.estado ? 'Desactivar' : 'Activar' }}</BaseButton>
      </template>
    </BaseDialog>
  </section>
</template>
