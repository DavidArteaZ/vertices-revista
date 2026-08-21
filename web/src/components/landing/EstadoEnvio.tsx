"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { CORREO } from "@/lib/validacion";

/**
 * Buscador de estado de pieza. Marcado de index.html:900-909,
 * validación de :2298-2313.
 *
 * Sólo valida: no hay consulta hasta la etapa 4.
 *
 * Nota para quien conecte la API: el regex del folio es correcto y quien
 * discrepa es el libro de Excel, que genera VTX-001 en vez de VTX-2026-001
 * (defecto 1 de la spec). No relajar esta validación para acomodarlo.
 */

const FOLIO = /^VTX-\d{4}-\d{1,4}$/;

export default function EstadoEnvio() {
  const t = useTranslations("estadoenvio");
  const tAviso = useTranslations("avisos");
  const [folio, setFolio] = useState("");
  const [correo, setCorreo] = useState("");
  const [res, setRes] = useState<{ clave: string | null; err: boolean }>({ clave: null, err: false });

  function consultar(e: React.FormEvent) {
    e.preventDefault();
    const f = folio.trim().toUpperCase();
    const c = correo.trim().toLowerCase();
    if (!FOLIO.test(f)) {
      setRes({ clave: "escribe_tu_folio_completo_por_ejemplo_vtx_2026_0_b793", err: true });
      return;
    }
    if (!CORREO.test(c)) {
      setRes({ clave: "escribe_el_correo_con_el_que_registraste_tu_piez_29f8", err: true });
      return;
    }
    setRes({ clave: "consultando", err: false });
  }

  return (
    <div id="estado" className="estado-bloque">
      <h3>{t("estado_de_tu_envio")}</h3>
      <p className="estado-intro">{t("consulta_en_que_etapa_va_tu_pieza_con_tu_folio_y_9379")}</p>
      <form className="estado-form" id="estadoForm" onSubmit={consultar}>
        <input
          type="text"
          id="estadoFolio"
          placeholder={t("folio_vtx_2026_001")}
          aria-label={t("folio")}
          autoComplete="off"
          value={folio}
          onChange={(e) => setFolio(e.target.value)}
        />
        <input
          type="email"
          id="estadoCorreo"
          placeholder={t("correo_registrado")}
          aria-label={t("correo_registrado")}
          value={correo}
          onChange={(e) => setCorreo(e.target.value)}
        />
        <button className="boton" type="submit">{t("consultar")}</button>
      </form>
      <div className={`estado-res${res.err ? " err" : ""}`} id="estadoRes" aria-live="polite">
        {res.clave ? tAviso(res.clave) : ""}
      </div>
    </div>
  );
}
