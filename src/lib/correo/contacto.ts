import "server-only";
import { Resend } from "resend";

export type ResultadoContacto = { guardado: boolean; motivo?: string };

/**
 * Añade al autor a la lista «Autores» de Resend después de que Supabase
 * confirma el envío. Si ya existe, Resend puede responder conflicto; eso se
 * considera equivalente a tenerlo ya en la lista y no invalida el envío.
 *
 * Sin `RESEND_LISTA_AUTORES` no se guarda nada. Crear el contacto sin lista lo
 * dejaría en la de por defecto, que nadie mira: parecería que funcionó y los
 * autores no estarían donde el comité los busca. Mejor que quede el motivo en
 * la bitácora del envío.
 */
export async function guardarContacto(correo: string, nombre: string): Promise<ResultadoContacto> {
  const clave = process.env.RESEND_API_KEY;
  if (!clave) return { guardado: false, motivo: "sin RESEND_API_KEY" };

  const lista = process.env.RESEND_LISTA_AUTORES;
  if (!lista) return { guardado: false, motivo: "sin RESEND_LISTA_AUTORES" };

  const partes = nombre.trim().split(/\s+/).filter(Boolean);
  const firstName = partes.shift() ?? "";
  const lastName = partes.join(" ");

  try {
    const { error } = await new Resend(clave).contacts.create({
      email: correo,
      firstName,
      lastName,
      unsubscribed: false,
      // Resend renombró «audiences» a «segments»; `audienceId` está obsoleto.
      segments: [{ id: lista }],
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
