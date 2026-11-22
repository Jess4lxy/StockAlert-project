<script setup lang="ts">
// Registro público: crea la empresa y la cuenta de su administrador (el dueño) y
// entra directo a su inventario vacío.
import { reactive, ref, watch } from 'vue';
import { mensajeDeError } from '@/api';
import PantallaAcceso from '@/components/PantallaAcceso.vue';
import { AppIcon, AvisoError, BaseButton, FormField, TextInput } from '@/components/ui';
import { useSesion } from '@/sesion';

const { registrar } = useSesion();

const datos = reactive({ empresa: '', nombre: '', correo: '', contrasena: '', confirmar: '' });
const errores = reactive({ empresa: '', nombre: '', correo: '', contrasena: '', confirmar: '' });
const verContrasena = ref(false);
const enviando = ref(false);
const error = ref('');

function validar(): boolean {
  const empresa = datos.empresa.trim();
  const nombre = datos.nombre.trim();
  const correo = datos.correo.trim();
  errores.empresa = empresa.length < 2 ? 'Escribe el nombre de tu negocio (mínimo 2 caracteres)' : '';
  errores.nombre = nombre.length < 2 ? 'Escribe tu nombre (mínimo 2 caracteres)' : '';
  errores.correo = !correo ? 'Escribe tu correo' : /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(correo) ? '' : 'Escribe un correo válido';
  errores.contrasena = datos.contrasena.length < 8 ? 'Usa al menos 8 caracteres' : '';
  errores.confirmar = datos.confirmar !== datos.contrasena ? 'Las contraseñas no coinciden' : '';
  return Object.values(errores).every((e) => !e);
}

// Tras el primer intento, los mensajes se actualizan mientras se escribe
let intentado = false;
watch(datos, () => intentado && validar());

async function crear() {
  error.value = '';
  intentado = true;
  if (!validar()) return;
  enviando.value = true;
  try {
    await registrar({
      empresa: datos.empresa.trim(),
      nombre: datos.nombre.trim(),
      correo: datos.correo.trim(),
      contrasena: datos.contrasena,
    });
    window.location.hash = '/dashboard';
  } catch (e) {
    error.value = mensajeDeError(e);
  } finally {
    enviando.value = false;
  }
}
</script>

<template>
  <PantallaAcceso ancho="lg">
    <form novalidate @submit.prevent="crear">
      <h1 class="mb-2 text-[32px] leading-10 font-medium text-texto">Registra tu negocio</h1>
      <p class="mb-8 text-base text-texto-suave">
        Crea la cuenta de tu negocio. Tú serás su administrador y podrás agregar a tu equipo después.
      </p>

      <section class="mb-6">
        <h2 class="mb-3 text-base font-semibold text-marino">Información del negocio</h2>
        <FormField id="empresa" label="Nombre del negocio" :error="errores.empresa">
          <TextInput id="empresa" v-model="datos.empresa" placeholder="Ej. Papelería La Esperanza" autocomplete="organization" :maxlength="150" :invalid="!!errores.empresa" />
        </FormField>
      </section>

      <section class="mb-8">
        <h2 class="mb-3 text-base font-semibold text-marino">Tu cuenta</h2>
        <div class="grid grid-cols-1 gap-4 md:grid-cols-2">
          <FormField id="nombre" label="Nombre completo" :error="errores.nombre">
            <TextInput id="nombre" v-model="datos.nombre" placeholder="Ej. Ana Pérez" autocomplete="name" :maxlength="100" :invalid="!!errores.nombre" />
          </FormField>
          <FormField id="correo" label="Correo electrónico" :error="errores.correo">
            <TextInput id="correo" v-model="datos.correo" type="email" placeholder="nombre@negocio.com" autocomplete="email" :maxlength="150" :invalid="!!errores.correo" />
          </FormField>
          <FormField id="contrasena" label="Contraseña" :error="errores.contrasena">
            <TextInput
              id="contrasena"
              v-model="datos.contrasena"
              :type="verContrasena ? 'text' : 'password'"
              placeholder="Mínimo 8 caracteres"
              autocomplete="new-password"
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
          <FormField id="confirmar" label="Confirma tu contraseña" :error="errores.confirmar">
            <TextInput
              id="confirmar"
              v-model="datos.confirmar"
              :type="verContrasena ? 'text' : 'password'"
              placeholder="Escríbela otra vez"
              autocomplete="new-password"
              :maxlength="128"
              :invalid="!!errores.confirmar"
            />
          </FormField>
        </div>
      </section>

      <BaseButton type="submit" class="w-full" :loading="enviando">Crear cuenta</BaseButton>

      <div class="mt-8 text-center">
        <p class="text-base text-texto-suave">¿Ya tienes cuenta?</p>
        <a href="#/login" class="text-base font-semibold text-marino hover:underline">Inicia sesión</a>
      </div>
    </form>
  </PantallaAcceso>

  <AvisoError v-model="error" />
</template>
