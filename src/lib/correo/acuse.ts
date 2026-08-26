import "server-only";
import { mandarPlantilla, type Envio } from "./enviar";

export type Acuse = {
  a: string;
  nombre: string;
  folio: string;
  titulo: string;
  seccion: string;
  genero: string;
  locale: string;
  origen: string;
};

/**
 * Resend tiene una plantilla publicada por idioma: `confirmacion_ES` y
 * `confirmacion_ENG`. El sitio habla seis idiomas y las plantillas son dos:
 * sólo el español tiene la suya, los otros cinco caen en la inglesa.
 *
 * Los aliases del PDF son el valor por defecto. Las variables de entorno se
 * conservan sólo para permitir un override explícito en otro entorno.
 */
export function plantillaDeLocale(locale: string): string {
  return locale === "es"
    ? process.env.RESEND_CONFIRMACION_TEMPLATE_ES || "confirmacion_ES"
    : process.env.RESEND_CONFIRMACION_TEMPLATE_ENG || "confirmacion_ENG";
}

/** Terminación que usa la plantilla española para concordar con la autoría. */
export function generoDePlantilla(genero: string): "o" | "a" | "e" {
  if (genero === "Masculino") return "o";
  if (genero === "Femenino") return "a";
  return "e";
}

/** La plantilla inglesa no usa `genero`, así que esa variable no se envía. */
export function variablesDeAcuse(a: Acuse): Record<string, string> {
  const comunes = {
    nombre: a.nombre,
    seccion: a.seccion,
    nom_pieza: a.titulo,
    folio: a.folio,
  };

  return a.locale === "es"
    ? { ...comunes, genero: generoDePlantilla(a.genero) }
    : comunes;
}

export function enviarAcuse(a: Acuse): Promise<Envio> {
  return mandarPlantilla(
    a.a,
    plantillaDeLocale(a.locale),
    variablesDeAcuse(a),
  );
}

export type { Envio as ResultadoAcuse };
