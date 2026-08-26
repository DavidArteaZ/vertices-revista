import "server-only";
import { createTranslator } from "next-intl";
import { Resend } from "resend";
import { LOCALES, LOCALE_POR_DEFECTO, type Locale } from "@/i18n/rutas";

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

export async function mandarPlantilla(
  a: string,
  plantilla: string,
  variables: Record<string, string | number>,
): Promise<Envio> {
  const clave = process.env.RESEND_API_KEY;
  if (!clave) return { enviado: false, motivo: "sin RESEND_API_KEY" };

  try {
    // Sin `from` a propósito: la plantilla ya trae el suyo y su `reply_to`, y
    // el `from` de la petición le ganaría. Con dos sitios donde vive el
    // remitente, tarde o temprano se manda desde el que no era.
    const { data, error } = await new Resend(clave).emails.send({
      to: a,
      template: { id: plantilla, variables },
    });
    return error ? { enviado: false, motivo: error.message } : { enviado: true, id: data?.id };
  } catch (e) {
    return { enviado: false, motivo: (e as Error).message };
  }
}

export function enlaceEstado(origen: string, locale: string): string {
  const idioma = esLocale(locale) ? locale : LOCALE_POR_DEFECTO;
  return `${origen}${idioma === LOCALE_POR_DEFECTO ? "" : `/${idioma}`}#estado`;
}
