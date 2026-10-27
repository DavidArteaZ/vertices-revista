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
        <p className="entrada">{t("14_estudiantes_1_asesor_5_areas_hacemos_vertices_dd38")}</p>
        <p className="indicacion">{t("pasa_el_cursor_o_toca_sobre_una_persona_para_con_cd54")}</p>
        <Constelacion />
      </main>
      <Pie satelite />
    </>
  );
}
