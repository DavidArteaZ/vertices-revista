import "server-only";
import { Resend } from "resend";

export type ResultadoBoletin = { guardado: boolean; motivo?: string };

const yaExiste = (m: string) => /already|exist/i.test(m);

/**
 * Añade el correo a la lista «Newsletter» de Resend (`RESEND_LISTA_NEWSLETTER`).
 *
 * Se hace en dos pasos y no con `segments` dentro de `create` porque, si el
 * contacto ya existía (un autor, alguien registrado a un lanzamiento), Resend
 * rechaza el `create` y la lista no se tocaría. Si existía dado de baja, se le
 * vuelve a dar de alta: acaba de pedir el boletín con su propia mano.
 */
export async function suscribirBoletin(correo: string): Promise<ResultadoBoletin> {
  const clave = process.env.RESEND_API_KEY;
  if (!clave) return { guardado: false, motivo: "sin RESEND_API_KEY" };

  const lista = process.env.RESEND_LISTA_NEWSLETTER;
  if (!lista) return { guardado: false, motivo: "sin RESEND_LISTA_NEWSLETTER" };

  try {
    const resend = new Resend(clave);

    const { error: eCrear } = await resend.contacts.create({ email: correo, unsubscribed: false });
    if (eCrear) {
      if (!yaExiste(eCrear.message)) return { guardado: false, motivo: eCrear.message };
      const { error: eAlta } = await resend.contacts.update({ email: correo, unsubscribed: false });
      if (eAlta) return { guardado: false, motivo: eAlta.message };
    }

    const { error: eLista } = await resend.contacts.segments.add({ email: correo, segmentId: lista });
    if (eLista && !yaExiste(eLista.message)) return { guardado: false, motivo: eLista.message };

    return { guardado: true };
  } catch (e) {
    return { guardado: false, motivo: (e as Error).message };
  }
}
