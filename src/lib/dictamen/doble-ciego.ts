/**
 * Sólo las secciones de investigación se dictaminan a doble ciego con
 * plantilla. En las demás la tarjeta basta: pedir el archivo ahí sería un
 * trámite sin lector. La misma lista vive en el disparador
 * privado.valida_archivo_doble_ciego; si cambia aquí, cambia allá.
 */
export const SECCIONES_DOBLE_CIEGO: readonly string[] = ["miradas-economicas", "horizonte-global"];

export function pideDobleCiego(slugSeccion: string | null | undefined): boolean {
  return !!slugSeccion && SECCIONES_DOBLE_CIEGO.includes(slugSeccion);
}
