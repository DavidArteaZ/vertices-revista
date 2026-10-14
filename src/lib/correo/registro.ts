import "server-only";
import { mandarPlantilla, type Envio } from "./enviar";

export type DatosEvento = {
  fecha_evento: string;
  hora_evento: string;
  ubicacion_evento: string;
};

/** Confirmación a quien se registra al evento de lanzamiento desde /registro. */
export function enviarConfirmacionRegistro(a: string, nombre: string, evento: DatosEvento): Promise<Envio> {
  return mandarPlantilla(
    a,
    process.env.RESEND_REGISTRO_EVENTO_TEMPLATE || "confirmacion_registroEvento",
    { nombre, ...evento },
  );
}
