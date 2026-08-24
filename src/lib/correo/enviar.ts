import "server-only";
import { createTranslator } from "next-intl";
import { Resend } from "resend";
import { LOCALES, LOCALE_POR_DEFECTO, type Locale } from "@/i18n/rutas";

/**
 * Lo común a los correos que la revista manda al autor.
 *
 * Dos reglas que valen para todos:
 *
 *   · van en el idioma con el que el autor envió, no en el de quien dispara el
 *     correo. El acuse lo dispara el propio autor y coinciden; el aviso de
 *     decisión lo dispara el comité desde un panel en español y no coinciden.
 *
 *   · no fallan nunca hacia arriba. Un correo que no sale no puede invalidar
 *     un manuscrito guardado ni una decisión grabada; el que llama anota el
 *     motivo en envio_eventos y sigue.
 */

/**
 * `id` es el que devuelve Resend. Se guarda para poder casar sus webhooks con
 * lo que se mandó: la invitación al comité no lleva folio en el asunto, así que
 * sin este id no habría forma de saber a quién rebotó un correo sin guardar la
 * dirección.
 */
export type Envio = { enviado: boolean; id?: string; motivo?: string };

const esLocale = (x: string): x is Locale => (LOCALES as readonly string[]).includes(x);

export type Redactor = (t: (clave: string, valores?: Record<string, string>) => string) => {
  asunto: string;
  lineas: string[];
};

export async function mandar(a: string, locale: string, redacta: Redactor): Promise<Envio> {
  const clave = process.env.RESEND_API_KEY;
  if (!clave) return { enviado: false, motivo: "sin RESEND_API_KEY" };

  try {
    const idioma = esLocale(locale) ? locale : LOCALE_POR_DEFECTO;
    const messages = (await import(`../../../messages/${idioma}.json`)).default;
    const t = createTranslator({ locale: idioma, messages, namespace: "correo" });

    const { asunto, lineas } = redacta(t as Parameters<Redactor>[0]);

    const { data, error } = await new Resend(clave).emails.send({
      from: process.env.CORREO_REMITENTE ?? "Revista Vértices <onboarding@resend.dev>",
      to: a,
      subject: asunto,
      text: lineas.join("\n"),
    });

    return error ? { enviado: false, motivo: error.message } : { enviado: true, id: data?.id };
  } catch (e) {
    return { enviado: false, motivo: (e as Error).message };
  }
}

/** Español vive en la raíz; los demás llevan prefijo (localePrefix as-needed). */
export function enlaceEstado(origen: string, locale: string): string {
  const idioma = esLocale(locale) ? locale : LOCALE_POR_DEFECTO;
  return `${origen}${idioma === LOCALE_POR_DEFECTO ? "" : `/${idioma}`}#estado`;
}
