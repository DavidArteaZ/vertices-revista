"use client";

import { useCallback, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import Lienzo from "./Lienzo";
import Carrusel from "./Carrusel";
import Convocatoria from "./Convocatoria";
import FormularioEnvio from "./FormularioEnvio";
import Lateral from "./Lateral";
import EstadoEnvio from "./EstadoEnvio";
import PanelArticulos, { type EstadoPanel } from "./PanelArticulos";
import Marco from "@/components/layout/Marco";
import Pie from "@/components/layout/Pie";
import type { TipoNodo } from "@/lib/motor/motor";
import type { Articulo } from "@/lib/datos/articulos";

export default function Portada({ articulos }: { articulos: Articulo[] }) {
  const t = useTranslations("portada");
  const locale = useLocale();
  const [panel, setPanel] = useState<EstadoPanel | null>(null);

  const abrirPanel = useCallback((tipo: TipoNodo, valor: string, valor0: string) => {
    setPanel({ tipo, valor, valor0, desdeIndice: false });
  }, []);
  const cerrarPanel = useCallback(() => setPanel(null), []);
  const verIndice = useCallback(() => {
    setPanel({ tipo: "indice", valor: null, valor0: null, desdeIndice: false });
  }, []);
  const abrirTema = useCallback((traducido: string, espanol: string) => {
    setPanel({ tipo: "tema", valor: traducido, valor0: espanol, desdeIndice: true });
  }, []);

  return (
    <>
      <h1 className="sr-solo">{t("vertices_revista_academica_de_economia_del_tecno_4187")}</h1>
      <Marco />
      <Lienzo onAbrirPanel={abrirPanel} onCerrarPanel={cerrarPanel} onVerIndice={verIndice} carrusel={<Carrusel articulos={articulos} />} />

      <main id="portal">
        <Convocatoria />
        <section className="portal-seccion" id="envio">
          <div className="tablero">
            <div className="panel-envio">
              <p className="ceja">{t("portal_de_envios")}</p>
              <h2>{locale === "es" ? "Envío de piezas" : "Piece submission"}</h2>
              <p className="fecha-limite">
                <strong>{t("fecha_limite_primera_edicion")}</strong>
                {t("veinte_de_septiembre_de_2026_los_archivos_recib")}
              </p>
              <FormularioEnvio />
            </div>
            <Lateral />
            <EstadoEnvio />
          </div>
        </section>
        <Pie />
      </main>

      <PanelArticulos articulos={articulos} estado={panel} onCerrar={cerrarPanel} onAbrirTema={abrirTema} onVolverIndice={verIndice} />

      <noscript>
        <p style={{ position: "fixed", inset: "auto 0 0", padding: 16, textAlign: "center", background: "#342b40", color: "#E7DECB", zIndex: 99 }}>{t("esta_pagina_necesita_javascript_para_mostrar_la_9e0c")}</p>
      </noscript>
    </>
  );
}
