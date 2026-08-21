/**
 * Validación del asistente de envío. Portado de index.html:2070-2097.
 *
 * Se extrae a módulo puro por dos razones: la etapa 4 vuelve a validar en el
 * servidor con estas mismas reglas, y así se puede probar sin DOM. El
 * original lee cada campo con document.getElementById; aquí llegan en un
 * objeto. Los mensajes se conservan carácter por carácter.
 */

export type DatosEnvio = {
  nombre: string;
  correo: string;
  perfil: string;
  afiliacion: string;
  coautores: string;
  genero: string;
  titulo: string;
  formato: string;
  seccion: string;
  tema: string;
  resumen: string;
  claves: string;
  usoIA: string;
  d1: boolean;
  d2: boolean;
  d3: boolean;
  d4: boolean;
};

/** Sólo lo que la validación necesita de un archivo adjunto. */
export type ArchivoLike = { name: string; size: number };

export const vacio: DatosEnvio = {
  nombre: "", correo: "", perfil: "", afiliacion: "", coautores: "", genero: "",
  titulo: "", formato: "", seccion: "", tema: "", resumen: "", claves: "",
  usoIA: "", d1: false, d2: false, d3: false, d4: false,
};

export const CORREO = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const v = (s: string) => s.trim();

export function validarPaso(
  i: number,
  d: DatosEnvio,
  archivos: ArchivoLike[],
): string | null {
  if (i === 0) {
    if (!v(d.nombre)) return "Escribe tu nombre completo.";
    if (!CORREO.test(v(d.correo))) return "Escribe un correo de contacto válido.";
    if (!v(d.perfil)) return "Elige tu perfil de autor.";
    if (!v(d.afiliacion)) return "Indica tu institución o afiliación.";
  }
  if (i === 1) {
    if (!v(d.titulo)) return "Tu manuscrito necesita un título.";
    if (!v(d.formato)) return "Elige el formato de tu pieza.";
    if (!v(d.seccion)) return "Elige la sección que mejor le queda a tu trabajo.";
    if (!v(d.tema)) return "Elige el tema principal.";
    const palabras = v(d.resumen).split(/\s+/).filter(Boolean).length;
    if (palabras < 100) {
      return "El resumen lleva {n} palabras; se piden al menos 100.".replace("{n}", String(palabras));
    }
    if (palabras > 300) {
      return "El resumen lleva {n} palabras; el máximo es 300.".replace("{n}", String(palabras));
    }
    const claves = v(d.claves).split(",").map((s) => s.trim()).filter(Boolean);
    if (claves.length < 3 || claves.length > 5) {
      return "Escribe de 3 a 5 palabras clave separadas por comas.";
    }
  }
  if (i === 2) {
    if (!archivos.length) return "Adjunta tu manuscrito en .docx o .pdf.";
  }
  if (i === 3) {
    if (!v(d.usoIA)) return "Indica si usaste herramientas de inteligencia artificial.";
    if (!(d.d1 && d.d2 && d.d3 && d.d4)) {
      return "Confirma las cuatro declaraciones para poder enviar.";
    }
  }
  return null;
}

/** index.html:2228-2230 */
export function pesoTexto(b: number): string {
  return b > 1048576 ? (b / 1048576).toFixed(1) + " MB" : Math.ceil(b / 1024) + " KB";
}

export const EXT_OK = /\.(pdf|docx?)$/i;
export const MAX_BYTES = 20 * 1048576;
