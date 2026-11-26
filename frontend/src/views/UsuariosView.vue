<script setup lang="ts">
// Usuarios. La plataforma ve los de todas las empresas (y crea en cualquiera); el
// admin de una empresa ve y administra solo a su equipo. Nadie puede cambiarse el rol
// ni desactivarse a sí mismo, para no quedarse sin acceso.
import { computed, onMounted, reactive, ref, watch } from 'vue';
import { api, mensajeDeError, type Pagina, type Rol, type Usuario } from '@/api';
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
  type Opcion,
  type Tono,
} from '@/components/ui';
import { useSesion } from '@/sesion';

const props = defineProps<{ empresaInicial?: number }>();

const { usuario: yo } = useSesion();
const esPlataforma = computed(() => yo.value?.rol === 'plataforma');

const filtros = reactive({ q: '', rol: '', estado: '', id_empresa: (props.empresaInicial ?? '') as number | '', page: 1, limit: 20 });
const resultado = ref<Pagina<Usuario> | null>(null);
const empresas = ref<Opcion<number | ''>[]>([]);
const cargando = ref(false);
const error = ref('');
const exito = ref('');

let controlador: AbortController | null = null;
async function cargar() {
  controlador?.abort();
  controlador = new AbortController();
  cargando.value = true;
  try {
    resultado.value = await api.usuarios({ ...filtros }, controlador.signal);
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
watch(() => [filtros.rol, filtros.estado, filtros.id_empresa, filtros.limit], reiniciar);
watch(() => filtros.page, cargar);
watch(
  () => props.empresaInicial,
  (id) => (filtros.id_empresa = id ?? ''),
);

onMounted(async () => {
  cargar();
  if (esPlataforma.value) {
    const lista = await api.empresas({ q: '', estado: '', page: 1, limit: 100 }).catch(() => null);
    empresas.value = (lista?.data ?? []).map((e) => ({ value: e.id_empresa, label: e.estado ? e.nombre : `${e.nombre} (inactiva)` }));
  }
});

function avisar(mensaje: string) {
  exito.value = mensaje;
  setTimeout(() => (exito.value = ''), 8000);
}

const ETIQUETA_ROL: Record<Rol, string> = { plataforma: 'Plataforma', admin: 'Administrador', almacen: 'Almacén' };
const TONO_ROL: Record<Rol, Tono> = { plataforma: 'marca', admin: 'info', almacen: 'neutro' };

const opcionesRolFiltro = computed(() => [
  { value: '', label: 'Todos' },
  ...(esPlataforma.value ? [{ value: 'plataforma', label: 'Plataforma' }] : []),
  { value: 'admin', label: 'Administrador' },
  { value: 'almacen', label: 'Almacén' },
]);
const opcionesRol = computed<Opcion<Rol>[]>(() => [
  { value: 'almacen', label: 'Almacén: registra movimientos y atiende alertas' },
  { value: 'admin', label: 'Administrador: además gestiona productos y usuarios' },
  ...(esPlataforma.value ? [{ value: 'plataforma' as Rol, label: 'Plataforma: crea empresas y usuarios' }] : []),
]);
const opcionesEstado = [
  { value: '', label: 'Todos' },
  { value: 'activo', label: 'Activos' },
  { value: 'inactivo', label: 'Inactivos' },
];
const opcionesEmpresaFiltro = computed<Opcion<number | ''>[]>(() => [{ value: '', label: 'Todas' }, ...empresas.value]);

// --- Crear / editar ------------------------------------------------------------
const dialogoAbierto = ref(false);
const editando = ref<Usuario | null>(null);
const form = reactive({ nombre: '', correo: '', contrasena: '', rol: 'almacen' as Rol, id_empresa: '' as number | '', activo: 'si' });
const errores = reactive({ nombre: '', correo: '', contrasena: '', id_empresa: '' });
const guardando = ref(false);
const errorDialogo = ref('');
// Su fila en la empresa (o plataforma) que tiene abierta
const esMiFila = (u: Usuario) => u.id_usuario === yo.value?.id_usuario && u.id_empresa === (yo.value?.empresa?.id_empresa ?? null);
const esYo = computed(() => !!editando.value && esMiFila(editando.value));
// El admin de una empresa no cambia los datos de una cuenta que también se usa en otra
const soloEmpresa = computed(() => !!editando.value?.cuenta_compartida && !esPlataforma.value && editando.value.id_usuario !== yo.value?.id_usuario);

// Tras el primer intento de guardar, los mensajes se actualizan mientras se escribe
let intentado = false;
watch(form, () => intentado && validar());

function limpiarErrores() {
  intentado = false;
  Object.assign(errores, { nombre: '', correo: '', contrasena: '', id_empresa: '' });
  errorDialogo.value = '';
}

function abrirNuevo() {
  editando.value = null;
  Object.assign(form, { nombre: '', correo: '', contrasena: '', rol: 'almacen', id_empresa: filtros.id_empresa, activo: 'si' });
  limpiarErrores();
  dialogoAbierto.value = true;
}

function abrirEditar(u: Usuario) {
  editando.value = u;
  Object.assign(form, { nombre: u.nombre, correo: u.correo, contrasena: '', rol: u.rol, id_empresa: u.id_empresa ?? '', activo: u.estado ? 'si' : 'no' });
  limpiarErrores();
  dialogoAbierto.value = true;
}

function validar(): boolean {
  errores.nombre = form.nombre.trim().length < 2 ? 'Escribe el nombre (mínimo 2 caracteres)' : '';
  errores.correo = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.correo.trim()) ? '' : 'Escribe un correo válido';
  // Al agregar puede ir vacía si el correo ya tiene cuenta: la API lo revisa
  const requiereContrasena = !editando.value && form.rol === 'plataforma';
  errores.contrasena =
    (requiereContrasena || form.contrasena) && form.contrasena.length < 8 ? 'Usa al menos 8 caracteres' : '';
  errores.id_empresa =
    esPlataforma.value && !editando.value && form.rol !== 'plataforma' && form.id_empresa === '' ? 'Elige la empresa' : '';
  return !Object.values(errores).some(Boolean);
}

async function guardar() {
  intentado = true;
  if (!validar()) return;
  guardando.value = true;
  errorDialogo.value = '';
  try {
    if (editando.value) {
      const u = editando.value;
      const cambios: Parameters<typeof api.editarUsuario>[1] = {};
      if (form.nombre.trim() !== u.nombre) cambios.nombre = form.nombre.trim();
      if (form.correo.trim().toLowerCase() !== u.correo) cambios.correo = form.correo.trim();
      if (form.rol !== u.rol) cambios.rol = form.rol;
      if ((form.activo === 'si') !== u.estado) cambios.estado = form.activo === 'si';
      if (form.contrasena) cambios.contrasena = form.contrasena;
      if (Object.keys(cambios).length) {
        if (esPlataforma.value && u.id_empresa) cambios.id_empresa = u.id_empresa;
        await api.editarUsuario(u.id_usuario, cambios);
      }
      avisar(`Usuario ${form.nombre.trim()} actualizado.`);
    } else {
      const creado = await api.crearUsuario({
        nombre: form.nombre.trim(),
        correo: form.correo.trim(),
        ...(form.contrasena ? { contrasena: form.contrasena } : {}),
        rol: form.rol,
        ...(esPlataforma.value && form.rol !== 'plataforma' ? { id_empresa: form.id_empresa as number } : {}),
      });
      avisar(
        creado.cuenta_existente
          ? `${creado.nombre} ya tenía cuenta: se agregó a ${creado.empresa}. Entra con su contraseña de siempre y cambia de empresa desde la barra superior.`
          : `Usuario ${creado.nombre} creado. Comparte con él su correo y contraseña inicial.`,
      );
    }
    dialogoAbierto.value = false;
    cargar();
  } catch (e) {
    errorDialogo.value = mensajeDeError(e);
  } finally {
    guardando.value = false;
  }
}

// Una persona puede salir varias veces: una fila por empresa
const filas = computed(() => (resultado.value?.data ?? []).map((u) => ({ ...u, fila: `${u.id_usuario}-${u.id_empresa ?? 0}` })));

const columnas = computed<Columna[]>(() => [
  { key: 'nombre', label: 'Usuario' },
  { key: 'rol', label: 'Rol' },
  ...(esPlataforma.value ? [{ key: 'empresa', label: 'Empresa' }] : []),
  { key: 'fecha_registro', label: 'Registro', class: 'whitespace-nowrap' },
  { key: 'estado', label: 'Estado' },
  { key: 'acciones', label: 'Acciones', align: 'right' as const },
]);

const fecha = new Intl.DateTimeFormat('es-MX', { timeZone: 'America/Merida', dateStyle: 'medium' });
</script>

<template>
  <section>
    <PageHeader
      title="Usuarios"
      :subtitle="esPlataforma ? 'Cuentas de todas las empresas y administradores de la plataforma.' : `Equipo de ${yo?.empresa?.nombre ?? 'tu empresa'}.`"
    >
      <template #actions>
        <BaseButton icon="add" @click="abrirNuevo">Nuevo usuario</BaseButton>
      </template>
    </PageHeader>

    <FilterBar :columns="esPlataforma ? 4 : 3">
      <FormField id="buscar-usuario" label="Nombre o correo">
        <TextInput id="buscar-usuario" v-model="filtros.q" type="search" icon="search" placeholder="Buscar" />
      </FormField>
      <FormField v-if="esPlataforma" id="filtro-empresa" label="Empresa">
        <SelectInput id="filtro-empresa" v-model="filtros.id_empresa" :options="opcionesEmpresaFiltro" />
      </FormField>
      <FormField id="filtro-rol" label="Rol">
        <SelectInput id="filtro-rol" v-model="filtros.rol" :options="opcionesRolFiltro" />
      </FormField>
      <FormField id="filtro-estado" label="Estado">
        <SelectInput id="filtro-estado" v-model="filtros.estado" :options="opcionesEstado" />
      </FormField>
    </FilterBar>

    <p v-if="exito" class="mb-3 rounded-lg bg-exito-10 p-3 text-sm text-exito" role="status">{{ exito }}</p>
    <p v-if="error" class="mb-3 rounded-lg bg-error-10 p-3 text-sm text-error">{{ error }}</p>

    <DataTable :columns="columnas" :rows="filas" row-key="fila" :loading="cargando" empty-text="No hay usuarios con esos filtros.">
      <template #cell-nombre="{ row }">
        <div class="flex flex-col">
          <span class="font-medium text-marino">{{ row.nombre }}<span v-if="esMiFila(row)" class="text-texto-suave"> (tú)</span></span>
          <span class="text-xs text-texto-suave">{{ row.correo }}</span>
        </div>
      </template>
      <template #cell-rol="{ row }">
        <StatusBadge :tone="TONO_ROL[row.rol]">{{ ETIQUETA_ROL[row.rol] }}</StatusBadge>
      </template>
      <template #cell-empresa="{ row }">{{ row.empresa ?? '—' }}</template>
      <template #cell-fecha_registro="{ row }">{{ fecha.format(new Date(row.fecha_registro)) }}</template>
      <template #cell-estado="{ row }">
        <StatusBadge :tone="row.estado ? 'exito' : 'neutro'">{{ row.estado ? 'Activo' : 'Inactivo' }}</StatusBadge>
      </template>
      <template #cell-acciones="{ row }">
        <div class="flex justify-end">
          <BaseButton variant="ghost" icon="edit" class="!h-9 !px-3 !text-sm" @click="abrirEditar(row)">Editar</BaseButton>
        </div>
      </template>
    </DataTable>

    <TablePagination v-if="resultado" v-model:page="filtros.page" v-model:limit="filtros.limit" :total="resultado.total" class="mt-2" />

    <BaseDialog
      v-model:open="dialogoAbierto"
      :title="editando ? 'Editar usuario' : 'Nuevo usuario'"
      :subtitle="editando ? editando.correo : 'Si su correo ya tiene cuenta, se agrega a la empresa con su contraseña de siempre.'"
      width="lg"
    >
      <form id="form-usuario" novalidate class="grid grid-cols-1 gap-4 md:grid-cols-2" @submit.prevent="guardar">
        <p v-if="soloEmpresa" class="rounded-lg bg-marino-10 p-3 text-sm text-texto md:col-span-2">
          {{ editando?.nombre }} también usa su cuenta en otro lugar: aquí puedes cambiar su rol y su acceso a esta empresa.
        </p>
        <FormField v-if="!soloEmpresa" id="usuario-nombre" label="Nombre completo" :error="errores.nombre">
          <TextInput id="usuario-nombre" v-model="form.nombre" placeholder="Ej. Ana Pérez" :maxlength="100" :invalid="!!errores.nombre" />
        </FormField>
        <FormField v-if="!soloEmpresa" id="usuario-correo" label="Correo" :error="errores.correo">
          <TextInput id="usuario-correo" v-model="form.correo" type="email" placeholder="nombre@negocio.com" autocomplete="off" :maxlength="150" :invalid="!!errores.correo" />
        </FormField>
        <FormField id="usuario-rol" label="Rol">
          <SelectInput v-if="!editando || (!esYo && editando.rol !== 'plataforma')" id="usuario-rol" v-model="form.rol" :options="opcionesRol.filter((o) => !editando || o.value !== 'plataforma')" />
          <p v-else class="flex h-[43px] items-center text-sm text-texto-suave">
            {{ ETIQUETA_ROL[form.rol] }} · {{ esYo ? 'no puedes cambiar tu propio rol' : 'el rol plataforma no se cambia' }}
          </p>
        </FormField>
        <FormField v-if="esPlataforma && !editando && form.rol !== 'plataforma'" id="usuario-empresa" label="Empresa" :error="errores.id_empresa">
          <SelectInput id="usuario-empresa" v-model="form.id_empresa" :options="empresas" placeholder="Elige una empresa" />
        </FormField>
        <FormField
          v-if="!soloEmpresa"
          id="usuario-contrasena"
          :label="editando ? 'Nueva contraseña (opcional)' : 'Contraseña inicial'"
          :error="errores.contrasena"
        >
          <TextInput
            id="usuario-contrasena"
            v-model="form.contrasena"
            type="password"
            :placeholder="editando ? 'Déjala vacía para no cambiarla' : 'Solo si es una cuenta nueva (mínimo 8)'"
            autocomplete="new-password"
            :maxlength="128"
            :invalid="!!errores.contrasena"
          />
        </FormField>
        <FormField v-if="editando" id="usuario-estado" label="Estado">
          <SelectInput
            v-if="!esYo"
            id="usuario-estado"
            v-model="form.activo"
            :options="[
              { value: 'si', label: 'Activo: puede entrar a la empresa' },
              { value: 'no', label: 'Inactivo: ya no entra a la empresa' },
            ]"
          />
          <p v-else class="flex h-[43px] items-center text-sm text-texto-suave">Activo · no puedes desactivar tu propia cuenta</p>
        </FormField>
        <p v-if="errorDialogo" class="rounded-lg bg-error-10 p-3 text-sm text-error md:col-span-2" role="alert">{{ errorDialogo }}</p>
      </form>
      <template #acciones>
        <BaseButton variant="outline" @click="dialogoAbierto = false">Cancelar</BaseButton>
        <BaseButton type="submit" form="form-usuario" :loading="guardando">{{ editando ? 'Guardar cambios' : 'Crear usuario' }}</BaseButton>
      </template>
    </BaseDialog>
  </section>
</template>
