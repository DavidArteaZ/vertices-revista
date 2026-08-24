import "server-only";
import { mandar, enlaceEstado, type Envio } from "./enviar";

/**
 * El acuse de recibo (spec §8.4).
 *
 * Nunca hace fallar el envío. Un manuscrito guardado y un correo no entregado
 * es recuperable —el folio se puede reenviar—; devolverle un error al autor lo
 * empujaría a mandar el manuscrito otra vez, y entonces habría dos.
 */
export type Acuse = {
  a: string;
  nombre: string;
  folio: string;
  titulo: string;
  locale: string;
  /** Origen absoluto, para que el enlace del correo no sea relativo. */
  origen: string;
};

export function enviarAcuse(a: Acuse): Promise<Envio> {
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
