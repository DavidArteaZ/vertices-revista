"use client";

import { useCallback, useState } from "react";
import "./globals.css";
import Lienzo from "@/components/landing/Lienzo";
import Carrusel from "@/components/landing/Carrusel";
import Convocatoria from "@/components/landing/Convocatoria";
import FormularioEnvio from "@/components/landing/FormularioEnvio";
import Lateral from "@/components/landing/Lateral";
import EstadoEnvio from "@/components/landing/EstadoEnvio";
import PanelArticulos, { type EstadoPanel } from "@/components/landing/PanelArticulos";
import Marco from "@/components/layout/Marco";
import Pie from "@/components/layout/Pie";
import type { TipoNodo } from "@/lib/motor/motor";

export default function Home() {
  const [panel, setPanel] = useState<EstadoPanel | null>(null);

  const abrirPanel = useCallback((tipo: TipoNodo, valor: string) => {
    setPanel({ tipo, valor, desdeIndice: false });
  }, []);
  const cerrarPanel = useCallback(() => setPanel(null), []);
  const verIndice = useCallback(() => {
    setPanel({ tipo: "indice", valor: null, desdeIndice: false });
  }, []);
  const abrirTema = useCallback((tema: string) => {
    setPanel({ tipo: "tema", valor: tema, desdeIndice: true });
  }, []);

  return (
    <>
      <h1 className="sr-solo">
        Vértices, revista académica de economía del Tecnológico de Monterrey, Campus Ciudad de México
      </h1>

      <Marco />

      <Lienzo
        onAbrirPanel={abrirPanel}
        onCerrarPanel={cerrarPanel}
        onVerIndice={verIndice}
        carrusel={<Carrusel />}
      />

      {/* ------- portal editorial (la palabra sigue al fondo, difuminada) ------- */}
      <main id="portal">
        <Convocatoria />

        <section className="portal-seccion" id="envio">
          <div className="tablero">
            <div className="panel-envio">
              <p className="ceja">Portal de envíos</p>
              <h2>Envío de manuscritos</h2>
              <FormularioEnvio />
            </div>
            <Lateral />
            <EstadoEnvio />
          </div>
        </section>

        <Pie />
      </main>

      <PanelArticulos
        estado={panel}
        onCerrar={cerrarPanel}
        onAbrirTema={abrirTema}
        onVolverIndice={verIndice}
      />

      <noscript>
        <p style={{ position: "fixed", inset: "auto 0 0", padding: 16, textAlign: "center", background: "#342b40", color: "#E7DECB", zIndex: 99 }}>
          Esta página necesita JavaScript para mostrar la red de partículas y el portal de envíos.
        </p>
      </noscript>
    </>
  );
}
