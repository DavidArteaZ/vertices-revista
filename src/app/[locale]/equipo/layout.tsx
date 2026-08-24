import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";

/**
 * La página es cliente (usa history.back), así que su <title> no puede salir
 * de ella. El sitio legado sí lo declara —equipo-ds.html:5— y idiomas.js lo
 * traduce como cualquier otro texto, de modo que aquí también se resuelve por
 * idioma.
 */
export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "equipo" });
  return { title: t("titulo_documento") };
}

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
