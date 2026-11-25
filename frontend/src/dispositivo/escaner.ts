// Lectura de códigos de barras con la cámara (getUserMedia). Usa BarcodeDetector donde el
// navegador lo incluye (Chrome en Android) y ZXing en los demás (iOS, Windows, Firefox).
// ZXing se carga solo cuando hace falta y queda guardado para usarse sin conexión.

interface Detector {
  detect(video: HTMLVideoElement): Promise<{ rawValue: string }[]>;
}
type ConstructorDetector = { new (o: { formats: string[] }): Detector; getSupportedFormats(): Promise<string[]> };

const FORMATOS = ['ean_13', 'ean_8', 'upc_a', 'upc_e', 'code_128', 'code_39', 'qr_code'];

async function detectorNativo(): Promise<Detector | null> {
  const Clase = (window as { BarcodeDetector?: ConstructorDetector }).BarcodeDetector;
  if (!Clase) return null;
  const formatos = (await Clase.getSupportedFormats()).filter((f) => FORMATOS.includes(f));
  return formatos.includes('ean_13') ? new Clase({ formats: formatos }) : null;
}

/** Abre la cámara trasera en el video y llama a `alLeer` con el primer código. Devuelve cómo detenerla. */
export async function escanear(video: HTMLVideoElement, alLeer: (codigo: string) => void): Promise<() => void> {
  if (!navigator.mediaDevices?.getUserMedia) throw new Error('Este navegador no permite usar la cámara. Escribe el código.');
  const flujo = await navigator.mediaDevices
    .getUserMedia({ video: { facingMode: 'environment', width: { ideal: 1280 }, height: { ideal: 720 } }, audio: false })
    .catch((e: DOMException) => {
      throw new Error(
        e.name === 'NotAllowedError'
          ? 'No diste permiso para usar la cámara. Actívalo en los ajustes del sitio o escribe el código.'
          : 'No se encontró una cámara disponible. Escribe el código.',
      );
    });

  let detenido = false;
  let detenerZxing = () => {};
  const detener = () => {
    detenido = true;
    detenerZxing();
    for (const pista of flujo.getTracks()) pista.stop();
    video.srcObject = null;
  };
  const encontrado = (codigo: string) => {
    if (detenido) return;
    detener();
    navigator.vibrate?.(80);
    alLeer(codigo);
  };

  try {
    video.srcObject = flujo;
    await video.play();
    const nativo = await detectorNativo().catch(() => null);
    if (nativo) {
      const revisar = async () => {
        if (detenido) return;
        const [codigo] = await nativo.detect(video).catch(() => []);
        if (codigo) encontrado(codigo.rawValue);
        else setTimeout(revisar, 150);
      };
      void revisar();
    } else {
      const { BrowserMultiFormatReader } = await import('@zxing/browser');
      if (!detenido) {
        const controles = await new BrowserMultiFormatReader().decodeFromVideoElement(video, (r) => r && encontrado(r.getText()));
        detenerZxing = () => controles.stop();
        if (detenido) controles.stop();
      }
    }
  } catch (error) {
    if (!detenido) detener();
    throw error;
  }
  return detener;
}
