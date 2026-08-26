import {
  CLAVES_CAMPO_SECCION,
  esGeneroEnvio,
  esModalidadEntrevista,
  esSeccionEnvio,
  rolPermitido,
  type CampoSeccion,
  type RolArchivo,
} from "@/lib/datos/portal-envios";

/** Los campos se declaran en CAMPOS_SECCION; aquí sólo se les da tipo. */
export type CamposSeccion = Record<CampoSeccion, string>;

export type DatosEnvio = {
  nombre: string;
  correo: string;
  perfil: string;
  afiliacion: string;
  coautores: string;
  seccion: string;
  genero: string;
  titulo: string;
  tema: string;
  claves: string;
  campos: CamposSeccion;
  usoIA: string;
  d1: boolean;
  d2: boolean;
  d3: boolean;
  d4: boolean;
  d5: boolean;
  d6: boolean;
};

/** Sólo lo que la validación necesita de un archivo adjunto. */
export type ArchivoLike = { name: string; size: number; rol: RolArchivo };

const camposVacios = Object.fromEntries(
  CLAVES_CAMPO_SECCION.map((c) => [c, ""]),
) as CamposSeccion;

export const vacio: DatosEnvio = {
  nombre: "",
  correo: "",
  perfil: "",
  afiliacion: "",
  coautores: "",
  seccion: "",
  genero: "",
  titulo: "",
  tema: "",
  claves: "",
  campos: camposVacios,
  usoIA: "",
  d1: false,
  d2: false,
  d3: false,
  d4: false,
  d5: false,
  d6: false,
};

export const CORREO = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const v = (s: string) => s.trim();

/** Clave dentro de `avisos` o clave local del portal. */
export type Aviso = { clave: string; valores?: Record<string, string | number> };

/**
 * Todas las claves de aviso del portal, en un solo sitio.
 *
 * Aquí viven también las que sólo devuelve la ruta del servidor y que el
 * navegador nunca dispara: mientras estuvieron declaradas aparte, ninguna
 * prueba podía recorrerlas y `portal_miradas_paper_max_35_paginas` llegó a
 * producción sin texto en ningún catálogo —el autor veía el código en bruto—.
 */
const AVISO = {
  nombre: "escribe_tu_nombre_completo",
  correo: "escribe_un_correo_de_contacto_valido",
  perfil: "elige_tu_perfil_de_autor",
  afiliacion: "indica_tu_institucion_o_afiliacion",
  coautores: "portal_coautores_max_2",
  seccion: "elige_la_seccion_que_mejor_le_queda_a_tu_trabajo",
  genero: "portal_genero_requerido",
  titulo: "tu_manuscrito_necesita_un_titulo",
  tema: "elige_el_tema_principal",
  claves: "escribe_de_3_a_5_palabras_clave_separadas_por_co_414e",
  textoDatanomics: "portal_datanomics_texto_200_800",
  visualizacionDatanomics: "portal_datanomics_visualizacion_1_3",
  repositorio: "portal_repositorio_url",
  semblanza: "portal_semblanza_requerida",
  modalidad: "portal_modalidad_requerida",
  foto: "portal_foto_requerida",
  cesion: "portal_cesion_requerida",
  resumenMiradas: "portal_miradas_resumen_100_300",
  paper: "portal_miradas_paper_requerido",
  anexos: "portal_miradas_anexos_max_3",
  resumenHorizonte: "portal_horizonte_resumen_max_200",
  articulo: "portal_horizonte_articulo_requerido",
  dato: "portal_sabias_dato_max_200",
  imagen: "portal_sabias_imagen_max_1",
  cronicaCapital: "portal_capital_cronica_500_900",
  fotosCapital: "portal_capital_fotos_1_4",
  pies: "portal_capital_pies_requeridos",
  cronicaExcelencia: "portal_excelencia_cronica_requerida",
  rol: "portal_rol_no_corresponde",
  usoIA: "indica_si_usaste_herramientas_de_inteligencia_ar_1e5d",
  declaraciones: "confirma_las_cuatro_declaraciones_para_poder_env_9d6c",
  extension: "a_no_es_pdf_ni_docx",
  peso: "a_pesa_mas_de_20_mb",
  archivos: "puedes_adjuntar_como_maximo_5_archivos",
  total: "entre_todos_los_archivos_se_pasan_de_50_mb",
  // Sólo las devuelve `POST /api/envios`; el navegador no puede alcanzarlas.
  limite: "demasiados_intentos",
  servidor: "no_pudimos_registrar_tu_envio",
  formato: "portal_archivo_tipo",
  subida: "no_pudimos_subir_a",
  paginas: "portal_miradas_paper_max_35_paginas",
} as const;

export { AVISO };

export function contarPalabras(texto: string): number {
  return v(texto).split(/\s+/).filter(Boolean).length;
}

const archivosDe = (archivos: ArchivoLike[], rol: RolArchivo) =>
  archivos.filter((a) => a.rol === rol);

/**
 * Cuenta coautores separando por coma.
 *
 * Limitación aceptada: quien escriba «Pérez, Ana» pensando en una sola persona
 * cuenta como dos. Distinguir «apellido, nombre» de «autor, autor» sin
 * preguntar no tiene solución fiable, y equivocarse hacia el lado estricto sólo
 * cuesta que el autor reescriba «Ana Pérez».
 */
function contarCoautores(texto: string): number {
  return v(texto).split(",").filter((s) => s.trim()).length;
}

function repositorioValido(url: string): boolean {
  if (!v(url)) return true;
  try {
    const u = new URL(v(url));
    return u.protocol === "http:" || u.protocol === "https:";
  } catch {
    return false;
  }
}

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
    // Campo opcional: vacío es válido, pero el tope de dos que anuncia el texto
    // de ayuda no lo comprobaba nadie.
    if (contarCoautores(d.coautores) > 2) return { clave: AVISO.coautores };
    if (!esSeccionEnvio(d.seccion)) return { clave: AVISO.seccion };
    /**
     * El género se contrasta contra su catálogo, no sólo contra el vacío,
     * porque viaja como variable de plantilla hasta Resend: sin esta línea es
     * una cadena que elige quien manda la petición y que acaba cruzando a un
     * tercero dentro de un correo que firmamos nosotros.
     */
    if (!esGeneroEnvio(v(d.genero))) return { clave: AVISO.genero };
  }

  if (i === 1) {
    if (!v(d.titulo)) return { clave: AVISO.titulo };
    if (!v(d.tema)) return { clave: AVISO.tema };
    const claves = v(d.claves).split(",").map((s) => s.trim()).filter(Boolean);
    if (claves.length < 3 || claves.length > 5) return { clave: AVISO.claves };
  }

  if (i === 2) {
    const c = d.campos;
    // Guarda contra peticiones manipuladas: desde el formulario es inalcanzable
    // porque `cambiarSeccion` vacía los archivos. Va antes que las reglas por
    // sección para que un rol ajeno no llegue a contarse como uno de los suyos.
    if (archivos.some((a) => !rolPermitido(d.seccion, a.rol))) return { clave: AVISO.rol };
    if (!repositorioValido(c.repositorio)) return { clave: AVISO.repositorio };

    if (d.seccion === "Datanomics") {
      const n = contarPalabras(c.textoExplicativo);
      if (n < 200 || n > 800) return { clave: AVISO.textoDatanomics, valores: { n } };
      const vis = archivosDe(archivos, "visualizacion").length;
      if (vis < 1 || vis > 3) return { clave: AVISO.visualizacionDatanomics };
    }

    if (d.seccion === "La Voz de la Experiencia") {
      if (!v(c.semblanza)) return { clave: AVISO.semblanza };
      // Contra el catálogo por lo mismo que el género: es texto que llega del
      // cliente y acaba en la ficha editorial sin que nadie lo acote después.
      if (!esModalidadEntrevista(v(c.modalidadEntrevista))) return { clave: AVISO.modalidad };
      if (archivosDe(archivos, "foto").length !== 1) return { clave: AVISO.foto };
      if (archivosDe(archivos, "cesion_imagen").length !== 1) return { clave: AVISO.cesion };
    }

    if (d.seccion === "Miradas Económicas") {
      const n = contarPalabras(c.resumen);
      if (n < 100 || n > 300) return { clave: AVISO.resumenMiradas, valores: { n } };
      if (archivosDe(archivos, "paper").length !== 1) return { clave: AVISO.paper };
      if (archivosDe(archivos, "anexo").length > 3) return { clave: AVISO.anexos };
    }

    if (d.seccion === "Horizonte Global") {
      const n = contarPalabras(c.resumen);
      if (n < 1 || n > 200) return { clave: AVISO.resumenHorizonte, valores: { n } };
      if (archivosDe(archivos, "articulo").length !== 1) return { clave: AVISO.articulo };
    }

    if (d.seccion === "¿Sabías Qué?") {
      const n = contarPalabras(c.dato);
      if (n < 1 || n > 200) return { clave: AVISO.dato, valores: { n } };
      if (archivosDe(archivos, "foto").length > 1) return { clave: AVISO.imagen };
    }

    if (d.seccion === "Capital Social") {
      const n = contarPalabras(c.cronica);
      if (n < 500 || n > 900) return { clave: AVISO.cronicaCapital, valores: { n } };
      const fotos = archivosDe(archivos, "foto").length;
      if (fotos < 1 || fotos > 4) return { clave: AVISO.fotosCapital };
      if (!v(c.piesImagen)) return { clave: AVISO.pies };
    }

    if (d.seccion === "Excelencia en Acción") {
      if (!v(c.semblanza)) return { clave: AVISO.semblanza };
      if (!v(c.cronica)) return { clave: AVISO.cronicaExcelencia };
      if (archivosDe(archivos, "foto").length !== 1) return { clave: AVISO.foto };
      if (archivosDe(archivos, "cesion_imagen").length !== 1) return { clave: AVISO.cesion };
    }
  }

  if (i === 3) {
    if (!v(d.usoIA)) return { clave: AVISO.usoIA };
    if (!(d.d1 && d.d3 && d.d4 && d.d5 && d.d6)) return { clave: AVISO.declaraciones };
  }
  return null;
}

export function pesoTexto(b: number): string {
  return b > 1048576 ? (b / 1048576).toFixed(1) + " MB" : Math.ceil(b / 1024) + " KB";
}

export const PDF_OK = /\.pdf$/i;
export const IMAGEN_OK = /\.(jpe?g|png|webp)$/i;
export const EXT_OK = /\.(pdf|jpe?g|png|webp)$/i;
export const MAX_BYTES = 20 * 1048576;
export const MAX_ARCHIVOS = 5;
export const MAX_BYTES_TOTAL = 50 * 1048576;

export function validarEnvio(d: DatosEnvio, archivos: ArchivoLike[]): Aviso | null {
  for (let i = 0; i < 4; i++) {
    const aviso = validarPaso(i, d, archivos);
    if (aviso) return aviso;
  }
  if (archivos.length > MAX_ARCHIVOS) return { clave: AVISO.archivos };
  if (archivos.reduce((s, a) => s + a.size, 0) > MAX_BYTES_TOTAL) return { clave: AVISO.total };
  return null;
}
