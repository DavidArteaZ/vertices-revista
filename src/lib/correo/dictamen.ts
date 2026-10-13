import "server-only";
import { mandarPlantilla, type Envio } from "./enviar";

export type AvisoDictamen = {
  a: string;
  nombreDictaminador: string;
  nombrePieza: string;
  puntaje: string;
  /** Sólo las secciones a doble ciego llevan plantilla que adjuntar. */
  adjunto: {
    nombre: string;
    contenidoBase64: string;
  } | null;
};

export function enviarDictamen(a: AvisoDictamen): Promise<Envio> {
  return mandarPlantilla(
    a.a,
    process.env.RESEND_DICTAMEN_ENVIADO_TEMPLATE || "dictamen_enviado",
    {
      nombre_dictaminador: a.nombreDictaminador,
      nombre_pieza: a.nombrePieza,
      puntaje: a.puntaje,
    },
    a.adjunto
      ? [
          {
            filename: a.adjunto.nombre,
            content: a.adjunto.contenidoBase64,
          },
        ]
      : [],
  );
}
