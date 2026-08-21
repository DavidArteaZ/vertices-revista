"use client";

import { useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { Link } from "@/i18n/navegacion";
import { LOCALE_POR_DEFECTO } from "@/i18n/rutas";
import Emblema from "./Emblema";

/**
 * Pie de página. Marcado de index.html:914-959, boletín de :2269-2274.
 *
 * El boletín no envía nada: sustituye el formulario por un agradecimiento.
 * Es exactamente lo que hace el sitio hoy y esta etapa lo preserva; la
 * etapa 4 decidirá si se conecta de verdad.
 */
export default function Pie({
  satelite = false,
  style,
}: { satelite?: boolean; style?: React.CSSProperties } = {}) {
  const t = useTranslations("pie");
  const [suscrito, setSuscrito] = useState(false);
  const [correo, setCorreo] = useState("");

  // igual que en Marco: en satélite las anclas apuntan a la raíz con hash y
  // no llevan data-u / data-ir (lineamientos.html:674-681)
  // En satélite el ancla vuelve a la portada, y tiene que conservar el idioma:
  // "/#temas" en español, "/en#temas" en inglés.
  const locale = useLocale();
  const raiz = locale === LOCALE_POR_DEFECTO ? "" : `/${locale}`;
  const a = (hash: string) => (satelite ? `${raiz || "/"}${hash}` : hash);
  const datos = (d: Record<string, string>) => (satelite ? {} : d);

  const enviar = (e: React.FormEvent) => {
    e.preventDefault();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(correo.trim())) return;
    setSuscrito(true);
  };

  return (
    <footer className="pie" style={style}>
      <div className="pie-int">
        <div className="pie-rejilla">
          <div className="pie-marca">
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
            <p>{t("revista_academica_de_economia_nacida_en_la_licen_2b17")}</p>
          </div>
          <div>
            <h4>{t("explora")}</h4>
            <ul>
              <li><a href={a("#temas")} {...datos({ "data-u": "0.48" })}>{t("temas")}</a></li>
              <li><a href={a("#secciones")} {...datos({ "data-u": "0.75" })}>{t("secciones")}</a></li>
              <li><a href={a("#convocatoria")} {...datos({ "data-ir": "convocatoria" })}>{t("convocatoria")}</a></li>
              {satelite
                ? <li><Link href="/lineamientos">{t("lineamientos")}</Link></li>
                : <li><a href="#lineamientos" data-ir="lineamientos">{t("lineamientos")}</a></li>}
              <li><a href={a("#estado")} {...datos({ "data-ir": "estado" })}>{t("estado_de_tu_envio")}</a></li>
            </ul>
          </div>
          <div>
            <h4>{t("contacto")}</h4>
            <ul>
              <li><a href="mailto:vertices@servicios.tec.mx">{t("vertices_servicios_tec_mx")}</a></li>
              <li><a href="#" rel="noopener">{t("instagram_vertices_ccm")}</a></li>
              <li><a href="#" rel="noopener">{t("linkedin_vertices_ccm")}</a></li>
            </ul>
          </div>
          <div className="boletin">
            <h4>{t("boletin")}</h4>
            <p>{t("recibe_cada_edicion_y_las_convocatorias_en_tu_co_4b97")}</p>
            {suscrito ? (
              <p style={{ color: "var(--crema)" }}>{t("listo_recibiras_la_proxima_edicion_en_tu_correo")}</p>
            ) : (
              <form id="boletinForm" onSubmit={enviar}>
                <input
                  type="email"
                  id="boletinCorreo"
                  placeholder={t("tu_correo")}
                  aria-label={t("tu_correo_7d11")}
                  value={correo}
                  onChange={(e) => setCorreo(e.target.value)}
                />
                <button className="boton" type="submit">{t("suscribirme")}</button>
              </form>
            )}
          </div>
        </div>
        <div className="pie-legal">
          <span>{t("2026_vertices_tecnologico_de_monterrey_campus_ci_8738")}</span>
          <span>{t("rigurosa_en_evidencia_amable_en_lectura")}{" "}<a href="#">{t("aviso_de_privacidad")}</a></span>
        </div>
      </div>
    </footer>
  );
}
