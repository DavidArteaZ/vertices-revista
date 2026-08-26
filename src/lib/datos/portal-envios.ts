export const SECCIONES_ENVIO = [
  "Datanomics",
  "La Voz de la Experiencia",
  "Miradas Económicas",
  "Horizonte Global",
  "¿Sabías Qué?",
  "Capital Social",
  "Excelencia en Acción",
] as const;

export type SeccionEnvio = (typeof SECCIONES_ENVIO)[number];

export const GENEROS_ENVIO = [
  "Prefiero no responder aquí",
  "Femenino",
  "Masculino",
  "Otro",
] as const;

export const MODALIDADES_ENTREVISTA = ["Presencial", "En línea"] as const;

export const ROLES_ARCHIVO = [
  "visualizacion",
  "foto",
  "cesion_imagen",
  "paper",
  "anexo",
  "articulo",
] as const;

export type RolArchivo = (typeof ROLES_ARCHIVO)[number];

/**
 * Cómo se llama cada rol para quien lee el panel.
 *
 * Vive pegado a ROLES_ARCHIVO a propósito: añadir un rol arriba rompe este
 * mapa y obliga a ponerle nombre antes de compilar. `adjunto` no está en
 * ROLES_ARCHIVO —el formulario nunca lo manda— pero es el valor por defecto de
 * la columna y el check de la migración lo admite, así que los envíos viejos
 * llegan con él y también necesitan etiqueta.
 */
export const ETIQUETA_ROL: Record<RolArchivo | "adjunto", string> = {
  visualizacion: "Visualización",
  foto: "Foto",
  cesion_imagen: "Cesión de imagen",
  paper: "Paper",
  anexo: "Anexo",
  articulo: "Artículo",
  adjunto: "Adjunto",
};

/** El rol llega de la base como texto libre; uno desconocido se enseña tal cual. */
export function etiquetaRol(rol: string): string {
  return rol in ETIQUETA_ROL
    ? ETIQUETA_ROL[rol as keyof typeof ETIQUETA_ROL]
    : rol.replace(/_/g, " ");
}

/**
 * Los ocho campos de texto del formulario, declarados una sola vez: su
 * etiqueta en español —la que lee el comité en el panel— y a qué secciones
 * pertenece cada uno. De aquí se deriva `CamposSeccion` en la validación, así
 * que un campo noveno se añade en una línea y no en tres archivos.
 *
 * El orden es el de lectura del panel: primero lo que escribió el autor y
 * `repositorio` al final, porque es un enlace y no texto de la pieza.
 */
export const CAMPOS_SECCION = {
  textoExplicativo: { etiqueta: "Texto explicativo", secciones: ["Datanomics"] },
  semblanza: {
    etiqueta: "Semblanza",
    secciones: ["La Voz de la Experiencia", "Excelencia en Acción"],
  },
  modalidadEntrevista: {
    etiqueta: "Modalidad de entrevista",
    secciones: ["La Voz de la Experiencia"],
  },
  resumen: { etiqueta: "Resumen", secciones: ["Miradas Económicas", "Horizonte Global"] },
  dato: { etiqueta: "Dato", secciones: ["¿Sabías Qué?"] },
  cronica: { etiqueta: "Crónica", secciones: ["Capital Social", "Excelencia en Acción"] },
  piesImagen: { etiqueta: "Pies de imagen", secciones: ["Capital Social"] },
  repositorio: { etiqueta: "Repositorio", secciones: ["Datanomics", "Miradas Económicas"] },
} as const satisfies Record<string, { etiqueta: string; secciones: readonly SeccionEnvio[] }>;

export type CampoSeccion = keyof typeof CAMPOS_SECCION;

/** Las claves en orden de declaración: es el orden en que se pintan. */
export const CLAVES_CAMPO_SECCION = Object.keys(CAMPOS_SECCION) as CampoSeccion[];

/** El PDF ya no pregunta el tipo; se deriva de la sección elegida. */
export const TIPO_POR_SECCION: Record<SeccionEnvio, string> = {
  Datanomics: "Visualización",
  "La Voz de la Experiencia": "Entrevista",
  "Miradas Económicas": "Paper/Investigación",
  "Horizonte Global": "Artículo",
  "¿Sabías Qué?": "Cápsula",
  "Capital Social": "Crónica",
  "Excelencia en Acción": "Crónica",
};

const ROLES_POR_SECCION: Record<SeccionEnvio, readonly RolArchivo[]> = {
  Datanomics: ["visualizacion"],
  "La Voz de la Experiencia": ["foto", "cesion_imagen"],
  "Miradas Económicas": ["paper", "anexo"],
  "Horizonte Global": ["articulo"],
  "¿Sabías Qué?": ["foto"],
  "Capital Social": ["foto"],
  "Excelencia en Acción": ["foto", "cesion_imagen"],
};

export function esSeccionEnvio(x: string): x is SeccionEnvio {
  return (SECCIONES_ENVIO as readonly string[]).includes(x);
}

export function esRolArchivo(x: string): x is RolArchivo {
  return (ROLES_ARCHIVO as readonly string[]).includes(x);
}

export function esGeneroEnvio(x: string): boolean {
  return (GENEROS_ENVIO as readonly string[]).includes(x);
}

export function esModalidadEntrevista(x: string): boolean {
  return (MODALIDADES_ENTREVISTA as readonly string[]).includes(x);
}

export function camposDeSeccion(seccion: string): CampoSeccion[] {
  if (!esSeccionEnvio(seccion)) return [];
  return CLAVES_CAMPO_SECCION.filter((c) =>
    (CAMPOS_SECCION[c].secciones as readonly string[]).includes(seccion),
  );
}

export function rolPermitido(seccion: string, rol: RolArchivo): boolean {
  return esSeccionEnvio(seccion) && ROLES_POR_SECCION[seccion].includes(rol);
}

export function tipoDeSeccion(seccion: string): string | null {
  return esSeccionEnvio(seccion) ? TIPO_POR_SECCION[seccion] : null;
}
