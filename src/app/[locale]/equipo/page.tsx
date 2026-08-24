"use client";

import { useRouter } from "next/navigation";
import { Link } from "@/i18n/navegacion";
import { useTranslations } from "next-intl";
import "./equipo.css";

/**
 * Página en construcción del equipo. Portada de equipo-ds.html:31-39.
 *
 * El enlace de regreso usa history.back() cuando hay historial y cae a la
 * raíz cuando no, igual que el original (equipo-ds.html:38).
 */
export default function Pagina() {
  const t = useTranslations("equipo");
  const router = useRouter();

  return (
    <main>
      <p className="ceja">{t("vertices_revista_academica_de_economia")}</p>
      <h1>{t("conoce_al_equipo")}</h1>
      <p>{t("pagina_en_construccion_aqui_viviran_los_siete_eq_5d60")}</p>
      <Link
        className="regreso"
        href="/"
        onClick={(e) => {
          if (window.history.length > 1) {
            e.preventDefault();
            router.back();
          }
        }}
      >{t("regresar")}</Link>
    </main>
  );
}
