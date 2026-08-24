"use client";

import { useEffect, useRef, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { Link } from "@/i18n/navegacion";
import { LOCALE_POR_DEFECTO } from "@/i18n/rutas";
import SelectorIdioma from "./SelectorIdioma";
import Emblema from "./Emblema";

/**
 * Marco fijo: marca y navegación en los márgenes.
 * Marcado de index.html:597-620, comportamiento del menú de :2389-2400.
 *
 * Los anclas internas (#temas, #secciones, #convocatoria, #estado) y sus
 * atributos data-u / data-ir se conservan intactos: el motor los lee en su
 * manejador delegado de clic.
 */
export default function Marco({
  satelite = false,
  style,
}: { satelite?: boolean; style?: React.CSSProperties } = {}) {
  const t = useTranslations("marco");
  const [abierto, setAbierto] = useState(false);
  const nav = useRef<HTMLElement>(null);

  // En la landing las anclas llevan data-u / data-ir y las gobierna el motor.
  // En las páginas satélite no hay motor, así que apuntan a la raíz con hash
  // (lineamientos.html:244-266).
  // En satélite el ancla vuelve a la portada, y tiene que conservar el idioma:
  // "/#temas" en español, "/en#temas" en inglés.
  const locale = useLocale();
  const raiz = locale === LOCALE_POR_DEFECTO ? "" : `/${locale}`;
  const a = (hash: string) => (satelite ? `${raiz || "/"}${hash}` : hash);
  const datos = (d: Record<string, string>) => (satelite ? {} : d);

  useEffect(() => {
    const fuera = (e: MouseEvent) => {
      if (!nav.current?.contains(e.target as Node)) setAbierto(false);
    };
    document.addEventListener("click", fuera);
    return () => document.removeEventListener("click", fuera);
  }, []);

  return (
    <header className="marco" style={style}>
      {satelite ? (
        <Link className="marca" href="/">
          <Emblema />
          <span>{t("vertices")}</span>
        </Link>
      ) : (
        <a className="marca" href="#" data-u="0">
          <Emblema />
          <span>{t("vertices")}</span>
        </a>
      )}
      <nav ref={nav} aria-label={t("navegacion_principal")} className={abierto ? "abierto" : undefined}>
        <Link className="enlace enlace-bar" href="/quienes-somos">{t("acerca_de")}</Link>
        <Link className="boton boton-bar" href="/equipo">{t("conoce_al_equipo")}</Link>
        <a className="boton boton--lleno" href={a("#envio")} {...datos({ "data-ir": "envio" })}>{t("publica_tu_articulo")}</a>
        <SelectorIdioma />
        <button
          className="menu-boton"
          type="button"
          aria-label={t("menu")}
          aria-expanded={abierto}
          aria-controls="menuPanel"
          onClick={() => setAbierto((v) => !v)}
        >
          <i></i><i></i><i></i>
        </button>
        <div className="menu-panel" id="menuPanel" onClick={() => setAbierto(false)}>
          <a className="enlace" href={a("#temas")} {...datos({ "data-u": "0.48" })}>{t("temas")}</a>
          <a className="enlace" href={a("#secciones")} {...datos({ "data-u": "0.75" })}>{t("secciones")}</a>
          <a className="enlace" href={a("#convocatoria")} {...datos({ "data-ir": "convocatoria" })}>{t("convocatoria")}</a>
          <Link className="enlace" href="/lineamientos">{t("lineamientos")}</Link>
          <a className="enlace" href={a("#estado")} {...datos({ "data-ir": "estado" })}>{t("estado_de_tu_envio")}</a>
          <Link className="enlace solo-angosto" href="/quienes-somos">{t("acerca_de")}</Link>
          <Link className="enlace solo-angosto" href="/equipo">{t("conoce_al_equipo")}</Link>
        </div>
      </nav>
    </header>
  );
}
