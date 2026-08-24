import "server-only";
import { mandar, type Envio } from "./enviar";

/**
 * Aviso al autor cada vez que el comité graba una decisión (spec §10).
 *
 * Va en el idioma con el que envió, que no es el de quien la graba: el panel
 * está en español y el autor puede haber enviado en ruso.
 *
 * La etiqueta de la decisión viaja tal cual la grabó el comité, sin traducir.
 * Es vocabulario del instrumento con el que se dictaminó —"Publicable con
 * cambios menores", "Requiere reelaboración (crítico < 2)"— y no son
 * equivalentes entre instrumentos: "Requiere reelaboración" es un veredicto de
 * Nivel C que no existe en el vocabulario de Nivel A. Traducirlo por nuestra
 * cuenta sería reinterpretar el veredicto.
 *
 * Lo que sí es deliberado es que sólo se avise de decisiones GRABADAS por el
 * comité, nunca de la que sugiere el motor. Hoy el libro filtra al autor la
 * decisión vigente, así que en cuanto alguien califica una dimensión el estado
 * público puede saltar a "No publicable (falla puerta ★)".
 */
export type AvisoDecision = {
  a: string;
  nombre: string;
  folio: string;
  titulo: string;
  decision: string;
  locale: string;
};

export function enviarDecision(a: AvisoDecision): Promise<Envio> {
  return mandar(a.a, a.locale, (t) => ({
    asunto: t("asunto_decision", { folio: a.folio }),
    lineas: [
      t("hola_nombre", { nombre: a.nombre }),
      "",
      t("el_comite_registro_decision", { titulo: a.titulo, decision: a.decision }),
      "",
      t("puedes_consultarlo_cuando_quieras"),
      "",
      t("gracias_por_enviar_a_vertices"),
      t("firma"),
      t("no_respondas_a_este_correo"),
    ],
  }));
}
