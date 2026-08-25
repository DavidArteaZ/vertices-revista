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

export function rolPermitido(seccion: string, rol: RolArchivo): boolean {
  return esSeccionEnvio(seccion) && ROLES_POR_SECCION[seccion].includes(rol);
}

export function tipoDeSeccion(seccion: string): string | null {
  return esSeccionEnvio(seccion) ? TIPO_POR_SECCION[seccion] : null;
}
