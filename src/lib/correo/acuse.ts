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

export function enviarAcuse(a: Acuse): Promise<Envio> {
  const plantilla = process.env.RESEND_CONFIRMACION_TEMPLATE_ID;
  if (plantilla) {
    return mandarPlantilla(a.a, plantilla, {
      lang: a.locale === "es" ? "es" : "eng",
      genero: a.genero,
      seccion: a.seccion,
      nom_pieza: a.titulo,
      folio: a.folio,
    });
  }

  // El sitio sigue siendo utilizable en desarrollo aunque la plantilla todavía
  // no esté configurada. En producción basta definir el id publicado de Resend.
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
