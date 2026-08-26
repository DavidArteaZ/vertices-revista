import "server-only";
import { mandar, mandarPlantilla, enlaceEstado, type Envio } from "./enviar";

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
 * Resend tiene una plantilla publicada por idioma —`confirmacion_ES` y
 * `confirmacion_ENG`—, no una sola parametrizada. El sitio habla seis idiomas y
 * las plantillas son dos: sólo el español tiene la suya, los otros cinco caen
 * en la inglesa. Es la misma regla que ya seguía la variable `lang`.
 */
export function plantillaDeLocale(locale: string): string | undefined {
  return locale === "es"
    ? process.env.RESEND_CONFIRMACION_TEMPLATE_ES
    : process.env.RESEND_CONFIRMACION_TEMPLATE_ENG;
}

export function enviarAcuse(a: Acuse): Promise<Envio> {
  const plantilla = plantillaDeLocale(a.locale);
  if (plantilla) {
    // Éstas son las cinco variables que declaran ambas plantillas. Una que
    // falte no da error: Resend pone su valor de reserva, así que el autor
    // recibiría un acuse con un hueco relleno de texto de ejemplo.
    return mandarPlantilla(a.a, plantilla, {
      nombre: a.nombre,
      genero: a.genero,
      seccion: a.seccion,
      nom_pieza: a.titulo,
      folio: a.folio,
    });
  }

  // El sitio sigue siendo utilizable en desarrollo aunque la plantilla todavía
  // no esté configurada. En producción basta definir el alias publicado en
  // Resend de las dos plantillas.
  return mandar(a.a, a.locale, (t) => ({
    asunto: t("asunto_acuse", { folio: a.folio }),
    lineas: [
      t("hola_nombre", { nombre: a.nombre }),
      "",
      t("registramos_tu_manuscrito_titulo", { titulo: a.titulo }),
      t("tu_folio_es_folio", { folio: a.folio }),
      "",
      t("entra_a_dictaminacion"),
      "",
      `${t("consultar_el_estado")}: ${enlaceEstado(a.origen, a.locale)}`,
      "",
      t("firma"),
      t("no_respondas_a_este_correo"),
    ],
  }));
}

export type { Envio as ResultadoAcuse };
