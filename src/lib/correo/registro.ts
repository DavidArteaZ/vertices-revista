import "server-only";
import { mandarPlantilla, type Envio } from "./enviar";

/** Confirmación a quien se registra al evento de lanzamiento desde /registro. */
export function enviarConfirmacionRegistro(a: string, nombre: string): Promise<Envio> {
  return mandarPlantilla(
    a,
    process.env.RESEND_REGISTRO_EVENTO_TEMPLATE || "confirmacion_registroEvento",
    { nombre },
  );
}
