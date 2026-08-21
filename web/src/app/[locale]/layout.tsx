import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { hasLocale, NextIntlClientProvider } from "next-intl";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { routing } from "@/i18n/rutas";
import "./selector-idioma.css";

/**
 * globals.css NO se importa aquí: es la hoja de la landing y cada página
 * satélite trae la suya, con sus propios @font-face y reglas de body.
 *
 * Cargarla en todas las rutas provoca colisiones de clase que en el sitio
 * original no existen, porque allí cada página satélite es un documento
 * autónomo que nunca ve el CSS de la landing. El caso concreto que lo
 * destapó: globals.css define .cierre como el botón redondo de cerrar el
 * panel (36x36, border-radius 50%), y lineamientos.html usa .cierre para su
 * bloque de cierre de página. Al cargar ambas hojas, el bloque quedaba
 * aplastado a 36px de alto.
 */

// Emblema de Vértices en línea, igual que en el sitio original (index.html:10)
const FAVICON =
  "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 32 32'%3E%3Cg fill='none' stroke='%232d232e' stroke-width='1.6'%3E%3Cpath d='M16 4 L28 26 L4 26 Z'/%3E%3Cpath d='M16 4 L17 18.5 M4 26 L17 18.5 M28 26 L17 18.5' opacity='.55'/%3E%3C/g%3E%3C/svg%3E";

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

/**
 * El sitio actual traduce también <title> (idiomas.js:61) y por eso el título
 * en español está en los cinco diccionarios. Aquí se resuelve por idioma en
 * el servidor, así que desaparece el parpadeo.
 */
export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "meta" });

  return {
    title: t("titulo"),
    description: t("descripcion"),
    openGraph: { title: t("og_titulo"), description: t("og_descripcion") },
    icons: { icon: FAVICON },
  };
}

export default async function RootLayout({
  children,
  params,
}: Readonly<{
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}>) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale);

  return (
    <html lang={locale}>
      <head>
        <link rel="preload" href="/fonts/NeueMontreal-Medium.woff2" as="font" type="font/woff2" crossOrigin="" />
        <link rel="preload" href="/fonts/NeueMontreal-Bold.woff2" as="font" type="font/woff2" crossOrigin="" />
        <link rel="preload" href="/fonts/Garet-Book.woff2" as="font" type="font/woff2" crossOrigin="" />
      </head>
      <body>
        <NextIntlClientProvider>{children}</NextIntlClientProvider>
      </body>
    </html>
  );
}
