export interface Opcion<T extends string | number = string> {
  value: T;
  label: string;
}

export interface Columna {
  /** Propiedad de la fila que se muestra; también nombra el slot `cell-<key>` */
  key: string;
  label: string;
  align?: 'left' | 'center' | 'right';
  /** Clases extra para las celdas de esa columna (ancho, nowrap, etc.) */
  class?: string;
}

export type Tono = 'exito' | 'info' | 'alerta' | 'error' | 'neutro' | 'marca';

export interface ItemNavegacion {
  id: string;
  label: string;
  icon: string;
}
