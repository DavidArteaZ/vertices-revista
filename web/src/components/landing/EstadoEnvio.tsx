"use client";

import { useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { CORREO } from "@/lib/validacion";

/**
 * Buscador de estado de pieza. Marcado de index.html:900-909,
 * validación de :2298-2313.
 *
 * El regex del folio es correcto y quien discrepa es el libro de Excel, que
 * genera VTX-001 en vez de VTX-2026-001 (defecto 1 de la spec). No relajarlo
 * para acomodarlo: lo que se corrigió fue el generador de folios.
 *
 * Lo que se muestra es la decisión GRABADA por el comité, o "en revisión". No
 * la que sugiere el motor de dictamen — hoy el libro filtra al autor la
 * decisión vigente, de modo que en cuanto un dictaminador califica una sola
 * dimensión el estado público puede saltar a "No publicable (falla puerta ★)"
 * (spec §10).
 */

const FOLIO = /^VTX-\d{4}-\d{1,4}$/;

type Consulta =
  | { tipo: "aviso"; clave: string; err: boolean }
  | { tipo: "resultado"; folio: string; titulo: string; recibido: string; decision: string | null };

export default function EstadoEnvio() {
  const t = useTranslations("estadoenvio");
  const tAviso = useTranslations("avisos");
  const locale = useLocale();
  const [folio, setFolio] = useState("");
  const [correo, setCorreo] = useState("");
  const [res, setRes] = useState<Consulta | null>(null);
  const [cargando, setCargando] = useState(false);

  async function consultar(e: React.FormEvent) {
    e.preventDefault();
    if (cargando) return;

    const f = folio.trim().toUpperCase();
    const c = correo.trim().toLowerCase();
    if (!FOLIO.test(f)) {
      setRes({ tipo: "aviso", clave: "escribe_tu_folio_completo_por_ejemplo_vtx_2026_0_b793", err: true });
      return;
    }
    if (!CORREO.test(c)) {
      setRes({ tipo: "aviso", clave: "escribe_el_correo_con_el_que_registraste_tu_piez_29f8", err: true });
      return;
    }

    setCargando(true);
    setRes({ tipo: "aviso", clave: "consultando", err: false });

    try {
      const r = await fetch("/api/estado", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ folio: f, correo: c }),
      });
      const cuerpo = (await r.json()) as {
        estado: string;
        folio?: string;
        titulo?: string;
        recibido_at?: string;
        decision?: string | null;
      };

      if (cuerpo.estado === "ok" && cuerpo.folio) {
        setRes({
          tipo: "resultado",
          folio: cuerpo.folio,
          titulo: cuerpo.titulo ?? "",
          recibido: new Date(cuerpo.recibido_at ?? "").toLocaleDateString(locale, {
            year: "numeric", month: "long", day: "numeric",
          }),
          decision: cuerpo.decision ?? null,
        });
      } else if (cuerpo.estado === "limite") {
        setRes({ tipo: "aviso", clave: "demasiados_intentos", err: true });
      } else if (cuerpo.estado === "no_coincide") {
        // Mismo mensaje que si el folio no existiera: la consulta pública no
        // debe servir para averiguar qué dirección envió qué (spec §13).
        setRes({ tipo: "aviso", clave: "no_encontramos_esa_combinacion_de_folio_y_correo", err: true });
      } else {
        setRes({ tipo: "aviso", clave: "no_pudimos_consultar_ahora", err: true });
      }
    } catch {
      setRes({ tipo: "aviso", clave: "no_pudimos_consultar_ahora", err: true });
    } finally {
      setCargando(false);
    }
  }

  const erroneo = res?.tipo === "aviso" && res.err;

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
        <button className="boton" type="submit" disabled={cargando}>{t("consultar")}</button>
      </form>
      <div className={`estado-res${erroneo ? " err" : ""}`} id="estadoRes" aria-live="polite">
        {res?.tipo === "aviso" && tAviso(res.clave)}
        {res?.tipo === "resultado" && (
          <>
            <strong>{res.folio}</strong> — {res.titulo}
            <br />
            {t("recibido_el_f", { f: res.recibido })}
            <br />
            {res.decision
              ? `${t("decision_del_comite")}: ${res.decision}`
              : t("en_revision")}
          </>
        )}
      </div>
    </div>
  );
}
