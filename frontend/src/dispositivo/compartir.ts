// Compartir contenido con otras apps (Web Share API). Donde no existe (p. ej., Firefox en
// escritorio) copia el texto al portapapeles.

export async function compartir(titulo: string, texto: string): Promise<'compartido' | 'copiado' | 'cancelado'> {
  if (navigator.share) {
    try {
      await navigator.share({ title: titulo, text: texto });
      return 'compartido';
    } catch (error) {
      if ((error as Error).name === 'AbortError') return 'cancelado';
      // Otros errores (p. ej., sin apps para compartir): se copia
    }
  }
  await navigator.clipboard.writeText(texto);
  return 'copiado';
}
