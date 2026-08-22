"use client";

import { useCallback, useState } from "react";
import { useTranslations } from "next-intl";
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

/**
 * La portada entera, del lado del cliente.
 *
 * Se separó de app/[locale]/page.tsx en la etapa 6: los artículos ya no son un
 * arreglo importado sino filas de la base, y quien los lee tiene que ser un
 * componente de servidor. Lo único que cambió aquí es que `articulos` llega
 * como propiedad; el resto es el mismo archivo.
 */
export default function Portada({ articulos }: { articulos: Articulo[] }) {
  const t = useTranslations("portada");
  const [panel, setPanel] = useState<EstadoPanel | null>(null);

  const abrirPanel = useCallback((tipo: TipoNodo, valor: string, valor0: string) => {
    setPanel({ tipo, valor, valor0, desdeIndice: false });
  }, []);
  const cerrarPanel = useCallback(() => setPanel(null), []);
  const verIndice = useCallback(() => {
    setPanel({ tipo: "indice", valor: null, valor0: null, desdeIndice: false });
  }, []);
  // El índice lista los temas en español (son los datos); el título del panel
  // los muestra traducidos.
  const abrirTema = useCallback((traducido: string, espanol: string) => {
    setPanel({ tipo: "tema", valor: traducido, valor0: espanol, desdeIndice: true });
  }, []);

  return (
    <>
      <h1 className="sr-solo">{t("vertices_revista_academica_de_economia_del_tecno_4187")}</h1>

      <Marco />

      <Lienzo
        onAbrirPanel={abrirPanel}
        onCerrarPanel={cerrarPanel}
        onVerIndice={verIndice}
        carrusel={<Carrusel articulos={articulos} />}
      />

      {/* ------- portal editorial (la palabra sigue al fondo, difuminada) ------- */}
      <main id="portal">
        <Convocatoria />

        <section className="portal-seccion" id="envio">
          <div className="tablero">
            <div className="panel-envio">
              <p className="ceja">{t("portal_de_envios")}</p>
              <h2>{t("envio_de_manuscritos")}</h2>
              <FormularioEnvio />
            </div>
            <Lateral />
            <EstadoEnvio />
          </div>
        </section>

        <Pie />
      </main>

      <PanelArticulos
        articulos={articulos}
        estado={panel}
        onCerrar={cerrarPanel}
        onAbrirTema={abrirTema}
        onVolverIndice={verIndice}
      />

      <noscript>
        <p style={{ position: "fixed", inset: "auto 0 0", padding: 16, textAlign: "center", background: "#342b40", color: "#E7DECB", zIndex: 99 }}>{t("esta_pagina_necesita_javascript_para_mostrar_la_9e0c")}</p>
      </noscript>
    </>
  );
}
