import "server-only";
import { createTranslator } from "next-intl";
import { Resend } from "resend";
import { LOCALES, LOCALE_POR_DEFECTO, type Locale } from "@/i18n/rutas";

/**
 * El acuse de recibo (spec §8.4, §10).
 *
 * Va en el idioma con el que el autor envió, no en el de la petición: son la
 * misma cosa ahora, pero dejarán de serlo en cuanto el panel mande correos de
 * decisión, y ese código va a reusar esto.
 *
 * Nunca hace fallar el envío. Un manuscrito guardado y un correo no entregado
 * es un problema recuperable —el folio se puede reenviar—; devolver un error
 * al autor por eso lo empujaría a mandar el manuscrito otra vez, y entonces
 * habría dos. Se registra en la bitácora y sigue.
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

export type ResultadoAcuse = { enviado: boolean; motivo?: string };

const esLocale = (x: string): x is Locale => (LOCALES as readonly string[]).includes(x);

export async function enviarAcuse(a: Acuse): Promise<ResultadoAcuse> {
  const clave = process.env.RESEND_API_KEY;
  if (!clave) return { enviado: false, motivo: "sin RESEND_API_KEY" };

  const locale = esLocale(a.locale) ? a.locale : LOCALE_POR_DEFECTO;
  const messages = (await import(`../../../messages/${locale}.json`)).default;
  const t = createTranslator({ locale, messages, namespace: "correo" });

  // Español vive en la raíz; los demás llevan prefijo (localePrefix as-needed).
  const enlace = `${a.origen}${locale === LOCALE_POR_DEFECTO ? "" : `/${locale}`}#estado`;

  try {
    const { error } = await new Resend(clave).emails.send({
      from: process.env.CORREO_REMITENTE ?? "Revista Vértices <onboarding@resend.dev>",
      to: a.a,
      subject: t("asunto_acuse", { folio: a.folio }),
      text: [
        t("hola_nombre", { nombre: a.nombre }),
        "",
        t("registramos_tu_manuscrito_titulo", { titulo: a.titulo }),
        t("tu_folio_es_folio", { folio: a.folio }),
        "",
        t("entra_a_dictaminacion"),
        "",
        `${t("consultar_el_estado")}: ${enlace}`,
        "",
        t("firma"),
        t("no_respondas_a_este_correo"),
      ].join("\n"),
    });

    if (error) return { enviado: false, motivo: error.message };
    return { enviado: true };
  } catch (e) {
    return { enviado: false, motivo: (e as Error).message };
  }
}
