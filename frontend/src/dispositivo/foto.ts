// Reduce la foto antes de guardarla: máximo 800 px por lado y JPEG de hasta 350 KB. Así
// cabe en la cola sin conexión, sube rápido con datos móviles y pierde los metadatos
// (ubicación, modelo del teléfono) que la cámara le agrega.

const LADO_MAXIMO = 800;
const BYTES_MAXIMOS = 350_000;

export async function comprimirFoto(archivo: Blob): Promise<{ tipo: string; bytes: ArrayBuffer }> {
  const imagen = await createImageBitmap(archivo).catch(() => {
    throw new Error('El archivo no es una imagen válida');
  });
  const escala = Math.min(1, LADO_MAXIMO / Math.max(imagen.width, imagen.height));
  const lienzo = document.createElement('canvas');
  lienzo.width = Math.round(imagen.width * escala);
  lienzo.height = Math.round(imagen.height * escala);
  const ctx = lienzo.getContext('2d')!;
  // Un PNG transparente quedaría con fondo negro en JPEG
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, lienzo.width, lienzo.height);
  ctx.drawImage(imagen, 0, 0, lienzo.width, lienzo.height);
  imagen.close();

  for (const calidad of [0.8, 0.6, 0.4]) {
    const blob = await new Promise<Blob | null>((r) => lienzo.toBlob(r, 'image/jpeg', calidad));
    if (blob && blob.size <= BYTES_MAXIMOS) return { tipo: 'image/jpeg', bytes: await blob.arrayBuffer() };
  }
  throw new Error('No se pudo reducir la foto lo suficiente. Intenta con otra.');
}
