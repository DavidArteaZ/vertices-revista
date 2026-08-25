import "server-only";
import { Resend } from "resend";

export type ResultadoContacto = { guardado: boolean; motivo?: string };

/**
 * Añade al autor a Contactos de Resend después de que Supabase confirma el
 * envío. Si ya existe, Resend puede responder conflicto; eso se considera
 * equivalente a tenerlo ya en la lista y no invalida el envío.
 */
export async function guardarContacto(correo: string, nombre: string): Promise<ResultadoContacto> {
  const clave = process.env.RESEND_API_KEY;
  if (!clave) return { guardado: false, motivo: "sin RESEND_API_KEY" };

  const partes = nombre.trim().split(/\s+/).filter(Boolean);
  const firstName = partes.shift() ?? "";
  const lastName = partes.join(" ");

  try {
    const { error } = await new Resend(clave).contacts.create({
      email: correo,
      firstName,
      lastName,
      unsubscribed: false,
    });

    if (!error) return { guardado: true };
    // Un contacto repetido ya satisface el objetivo de pertenecer a la lista.
    if (error.message.toLowerCase().includes("already") || error.message.toLowerCase().includes("exist")) {
      return { guardado: true };
    }
    return { guardado: false, motivo: error.message };
  } catch (e) {
    return { guardado: false, motivo: (e as Error).message };
  }
}
