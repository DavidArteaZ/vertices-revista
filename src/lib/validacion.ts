/**
 * Validación del asistente de envío. Portado de index.html:2070-2097.
 *
 * Se extrae a módulo puro por dos razones: la etapa 4 vuelve a validar en el
 * servidor con estas mismas reglas, y así se puede probar sin DOM. El
 * original lee cada campo con document.getElementById; aquí llegan en un
 * objeto.
 *
 * Desde la etapa 2 no devuelve texto español sino la clave del aviso y sus
 * parámetros. El original llamaba TR() sobre el literal, que es el mismo
 * mecanismo; separar el mensaje del juicio también le sirve al servidor de la
 * etapa 4, que tiene que redactar el error en el idioma del autor y no en el
 * de la petición. El texto en sí vive en el catálogo, bajo `avisos.*`.
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
  d5: boolean;
  d6: boolean;
};

/** Sólo lo que la validación necesita de un archivo adjunto. */
export type ArchivoLike = { name: string; size: number };

export const vacio: DatosEnvio = {
  nombre: "", correo: "", perfil: "", afiliacion: "", coautores: "", genero: "",
  titulo: "", formato: "", seccion: "", tema: "", resumen: "", claves: "",
  usoIA: "", d1: false, d2: false, d3: false, d4: false, d5: false, d6: false,
};

export const CORREO = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const v = (s: string) => s.trim();

/** Clave dentro del espacio `avisos` más, si lleva, sus parámetros ICU. */
export type Aviso = { clave: string; valores?: Record<string, string | number> };

const AVISO = {
  nombre: "escribe_tu_nombre_completo",
  correo: "escribe_un_correo_de_contacto_valido",
  perfil: "elige_tu_perfil_de_autor",
  afiliacion: "indica_tu_institucion_o_afiliacion",
  titulo: "tu_manuscrito_necesita_un_titulo",
  formato: "elige_el_formato_de_tu_pieza",
  seccion: "elige_la_seccion_que_mejor_le_queda_a_tu_trabajo",
  tema: "elige_el_tema_principal",
  resumenCorto: "el_resumen_lleva_n_palabras_se_piden_al_menos_10_c4d7",
  resumenLargo: "el_resumen_lleva_n_palabras_el_maximo_es_300",
  claves: "escribe_de_3_a_5_palabras_clave_separadas_por_co_414e",
  archivos: "adjunta_tu_manuscrito_en_docx_o_pdf",
  usoIA: "indica_si_usaste_herramientas_de_inteligencia_ar_1e5d",
  declaraciones: "confirma_las_cuatro_declaraciones_para_poder_env_9d6c",
  extension: "a_no_es_pdf_ni_docx",
  peso: "a_pesa_mas_de_20_mb",
} as const;

export { AVISO };

export function validarPaso(
  i: number,
  d: DatosEnvio,
  archivos: ArchivoLike[],
): Aviso | null {
  if (i === 0) {
    if (!v(d.nombre)) return { clave: AVISO.nombre };
    if (!CORREO.test(v(d.correo))) return { clave: AVISO.correo };
    if (!v(d.perfil)) return { clave: AVISO.perfil };
    if (!v(d.afiliacion)) return { clave: AVISO.afiliacion };
  }
  if (i === 1) {
    if (!v(d.titulo)) return { clave: AVISO.titulo };
    if (!v(d.formato)) return { clave: AVISO.formato };
    if (!v(d.seccion)) return { clave: AVISO.seccion };
    if (!v(d.tema)) return { clave: AVISO.tema };
    const palabras = v(d.resumen).split(/\s+/).filter(Boolean).length;
    if (palabras < 100) return { clave: AVISO.resumenCorto, valores: { n: palabras } };
    if (palabras > 300) return { clave: AVISO.resumenLargo, valores: { n: palabras } };
    const claves = v(d.claves).split(",").map((s) => s.trim()).filter(Boolean);
    if (claves.length < 3 || claves.length > 5) return { clave: AVISO.claves };
  }
  if (i === 2) {
    if (!archivos.length) return { clave: AVISO.archivos };
  }
  if (i === 3) {
    if (!v(d.usoIA)) return { clave: AVISO.usoIA };
    if (!(d.d1 && d.d3 && d.d4 && d.d5 && d.d6)) return { clave: AVISO.declaraciones };
  }
  return null;
}

/** index.html:2228-2230 */
export function pesoTexto(b: number): string {
  return b > 1048576 ? (b / 1048576).toFixed(1) + " MB" : Math.ceil(b / 1024) + " KB";
}

export const EXT_OK = /\.(pdf|docx?)$/i;
export const MAX_BYTES = 20 * 1048576;

/**
 * Topes que el sitio actual no tiene porque el archivo viajaba dentro del POST
 * y el límite lo ponía el tamaño de la petición. Ahora la subida va directa a
 * Storage, así que si nadie los escribe no existen (spec §8).
 */
export const MAX_ARCHIVOS = 5;
export const MAX_BYTES_TOTAL = 50 * 1048576;

/**
 * Los cuatro pasos de una vez. El asistente valida uno a uno según avanza; el
 * servidor no ve pasos, ve un cuerpo JSON que puede venir de cualquier sitio,
 * y tiene que aplicar exactamente las mismas reglas.
 */
export function validarEnvio(d: DatosEnvio, archivos: ArchivoLike[]): Aviso | null {
  for (let i = 0; i < 4; i++) {
    const aviso = validarPaso(i, d, archivos);
    if (aviso) return aviso;
  }
  if (archivos.length > MAX_ARCHIVOS) return { clave: AVISO.archivos };
  if (archivos.reduce((s, a) => s + a.size, 0) > MAX_BYTES_TOTAL) return { clave: AVISO.archivos };
  return null;
}
