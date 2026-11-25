<script setup lang="ts">
// Operaciones registradas sin conexión: las que esperan envío y las que la API rechazó,
// con su motivo, para reintentarlas o descartarlas.
import { BaseButton, BaseDialog, StatusBadge } from '@/components/ui';
import { descartar, reintentar, sincronizar, useInventario, type Operacion } from '@/datos/inventario';
import { usePwa } from '@/pwa/usePwa';

const abierto = defineModel<boolean>('open', { required: true });
const { cola, pendientes, sincronizando } = useInventario();
const { enLinea } = usePwa();

function describir(op: Operacion): string {
  const m = op.movimiento;
  switch (op.tipo) {
    case 'crear_producto':
      return 'Alta de producto';
    case 'editar_producto':
      return 'Edición de producto';
    case 'estado_producto':
      return op.activo ? 'Activación de producto' : 'Desactivación de producto';
    case 'foto_producto':
      return op.foto ? 'Foto nueva' : 'Quitar foto';
    case 'movimiento': {
      const nombre = m!.tipo_movimiento[0].toUpperCase() + m!.tipo_movimiento.slice(1);
      return `${nombre} de ${Math.abs(m!.cantidad)}${m!.cantidad < 0 ? ' (resta)' : ''}`;
    }
  }
}

const fecha = new Intl.DateTimeFormat('es-MX', { timeZone: 'America/Merida', dateStyle: 'medium', timeStyle: 'short' });
</script>

<template>
  <BaseDialog v-model:open="abierto" title="Pendientes de enviar" subtitle="Lo registrado sin conexión se envía solo cuando vuelve el Internet." width="lg">
    <p v-if="!cola.length" class="py-6 text-center text-sm text-texto-suave">Todo está sincronizado.</p>
    <ul v-else class="flex flex-col gap-3">
      <li v-for="op in cola" :key="op.id" class="rounded-lg border border-slate-200 p-3">
        <div class="flex items-start justify-between gap-3">
          <div class="min-w-0">
            <p class="truncate font-medium text-marino">{{ op.nombreProducto }}</p>
            <p class="text-sm text-texto">{{ describir(op) }} · {{ fecha.format(new Date(op.fecha)) }}</p>
          </div>
          <StatusBadge :tone="op.estado === 'rechazada' ? 'error' : 'alerta'">{{ op.estado === 'rechazada' ? 'Rechazada' : 'Por enviar' }}</StatusBadge>
        </div>
        <p v-if="op.error" class="mt-2 text-sm text-error">{{ op.error }}</p>
        <div v-if="op.estado === 'rechazada'" class="mt-2 flex gap-2">
          <BaseButton variant="outline" class="!h-9 !px-3 !text-sm" :disabled="!enLinea" @click="reintentar(op)">Reintentar</BaseButton>
          <BaseButton variant="ghost" class="!h-9 !px-3 !text-sm" @click="descartar(op)">Descartar</BaseButton>
        </div>
      </li>
    </ul>
    <template #acciones>
      <BaseButton variant="outline" @click="abierto = false">Cerrar</BaseButton>
      <BaseButton v-if="pendientes.length" icon="sync" :disabled="!enLinea" :loading="sincronizando" @click="sincronizar">
        {{ enLinea ? 'Enviar ahora' : 'Sin conexión' }}
      </BaseButton>
    </template>
  </BaseDialog>
</template>
