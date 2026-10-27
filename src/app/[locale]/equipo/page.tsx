import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import Marco from "@/components/layout/Marco";
import Pie from "@/components/layout/Pie";
import Constelacion from "./Constelacion";
import "./equipo.css";
import "../movil.css";

type Props = { params: Promise<{ locale: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "equipo" });
  return { title: t("titulo_documento") };
}

/**
 * Conoce al equipo. Lleva la barra y el pie de la portada, como las demás
 * satélites, y en medio la constelación del equipo. Sin el campo de flujo de
 * fondo que usa ¿Quiénes somos?: aquí las líneas son el contenido, y las
 * estelas del fondo competirían con ellas.
 */
export default async function Pagina({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("equipo");

  return (
    <>
      <Marco satelite />
      <main className="equipo">
        <p className="ceja">{t("vertices_revista_academica_de_economia")}</p>
        <h1>{t("conoce_al_equipo")}</h1>
        <p className="entrada">{t("somos_estudiantes_de_la_licenciatura_en_economia_9fac")}</p>
        <Constelacion />
      </main>
      <Pie satelite />
    </>
  );
}
