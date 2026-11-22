<script setup lang="ts">
import { reactive, ref, watch } from 'vue';
import { mensajeDeError } from '@/api';
import PantallaAcceso from '@/components/PantallaAcceso.vue';
import { AppIcon, AvisoError, BaseButton, FormField, TextInput } from '@/components/ui';
import { useSesion } from '@/sesion';

const { iniciarSesion, aviso } = useSesion();

const datos = reactive({ correo: '', contrasena: '' });
const errores = reactive({ correo: '', contrasena: '' });
const verContrasena = ref(false);
const enviando = ref(false);
const error = ref('');

function validar(): boolean {
  errores.correo = !datos.correo.trim()
    ? 'Escribe tu correo'
    : /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(datos.correo.trim())
      ? ''
      : 'Escribe un correo válido, por ejemplo nombre@negocio.com';
  errores.contrasena = datos.contrasena ? '' : 'Escribe tu contraseña';
  return !errores.correo && !errores.contrasena;
}

// Tras el primer intento, los mensajes se actualizan mientras se escribe
let intentado = false;
watch(datos, () => intentado && validar());

async function entrar() {
  error.value = '';
  intentado = true;
  if (!validar()) return;
  enviando.value = true;
  try {
    await iniciarSesion(datos.correo.trim(), datos.contrasena);
  } catch (e) {
    error.value = mensajeDeError(e);
  } finally {
    enviando.value = false;
  }
}
</script>

<template>
  <PantallaAcceso>
    <form novalidate @submit.prevent="entrar">
      <h1 class="mb-2 text-[32px] leading-10 font-medium text-texto">Iniciar sesión</h1>
      <p class="mb-8 text-base text-texto-suave">Consulta tu inventario, registra movimientos y atiende alertas.</p>

      <p v-if="aviso" class="mb-6 flex items-start gap-2 rounded-lg bg-alerta-10 p-3 text-sm text-texto" role="status">
        <AppIcon name="error" :size="18" class="mt-0.5 text-alerta" />
        {{ aviso }}
      </p>

      <div class="flex flex-col gap-6">
        <FormField id="correo" label="Correo electrónico" :error="errores.correo">
          <TextInput
            id="correo"
            v-model="datos.correo"
            type="email"
            placeholder="nombre@negocio.com"
            autocomplete="email"
            :maxlength="150"
            :invalid="!!errores.correo"
          />
        </FormField>

        <FormField id="contrasena" label="Contraseña" :error="errores.contrasena">
          <TextInput
            id="contrasena"
            v-model="datos.contrasena"
            :type="verContrasena ? 'text' : 'password'"
            placeholder="•••••••••"
            autocomplete="current-password"
            :maxlength="128"
            :invalid="!!errores.contrasena"
          >
            <template #sufijo>
              <button
                type="button"
                class="rounded-md p-2 text-texto-suave hover:text-marino"
                :aria-label="verContrasena ? 'Ocultar contraseña' : 'Mostrar contraseña'"
                :aria-pressed="verContrasena"
                @click="verContrasena = !verContrasena"
              >
                <AppIcon :name="verContrasena ? 'visibility' : 'visibility_off'" :size="20" />
              </button>
            </template>
          </TextInput>
        </FormField>

        <BaseButton type="submit" class="w-full" :loading="enviando">Iniciar sesión</BaseButton>
      </div>

      <div class="mt-8 text-center">
        <p class="text-base text-texto-suave">¿Tu negocio aún no usa StockAlert?</p>
        <a href="#/registro" class="text-base font-semibold text-marino hover:underline">Registra tu negocio</a>
      </div>
    </form>
  </PantallaAcceso>

  <AvisoError v-model="error" />
</template>
