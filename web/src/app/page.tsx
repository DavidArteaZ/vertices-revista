"use client";

import { useCallback, useState } from "react";
import Lienzo from "@/components/landing/Lienzo";
import Carrusel from "@/components/landing/Carrusel";
import type { TipoNodo } from "@/lib/motor/motor";

type EstadoPanel = { tipo: TipoNodo | "indice"; valor: string | null; desdeIndice: boolean } | null;

export default function Home() {
  const [panel, setPanel] = useState<EstadoPanel>(null);

  const abrirPanel = useCallback((tipo: TipoNodo, valor: string) => {
    setPanel({ tipo, valor, desdeIndice: false });
  }, []);
  const cerrarPanel = useCallback(() => setPanel(null), []);
  const verIndice = useCallback(() => {
    setPanel({ tipo: "indice", valor: null, desdeIndice: false });
  }, []);

  return (
    <>
      <h1 className="sr-solo">
        Vértices, revista académica de economía del Tecnológico de Monterrey, Campus Ciudad de México
      </h1>

      <Lienzo
        onAbrirPanel={abrirPanel}
        onCerrarPanel={cerrarPanel}
        onVerIndice={verIndice}
        carrusel={<Carrusel />}
      />

      <main id="portal"></main>

      <noscript>
        <p style={{ position: "fixed", inset: "auto 0 0", padding: 16, textAlign: "center", background: "#342b40", color: "#E7DECB", zIndex: 99 }}>
          Esta página necesita JavaScript para mostrar la red de partículas y el portal de envíos.
        </p>
      </noscript>
    </>
  );
}
