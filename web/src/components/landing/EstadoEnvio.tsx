"use client";

import { useState } from "react";
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
  const [folio, setFolio] = useState("");
  const [correo, setCorreo] = useState("");
  const [res, setRes] = useState<{ texto: string; err: boolean }>({ texto: "", err: false });

  function consultar(e: React.FormEvent) {
    e.preventDefault();
    const f = folio.trim().toUpperCase();
    const c = correo.trim().toLowerCase();
    if (!FOLIO.test(f)) {
      setRes({ texto: "Escribe tu folio completo, por ejemplo VTX-2026-001.", err: true });
      return;
    }
    if (!CORREO.test(c)) {
      setRes({ texto: "Escribe el correo con el que registraste tu pieza.", err: true });
      return;
    }
    setRes({ texto: "Consultando…", err: false });
  }

  return (
    <div id="estado" className="estado-bloque">
      <h3>Estado de tu envío</h3>
      <p className="estado-intro">Consulta en qué etapa va tu pieza con tu folio y el correo que registraste.</p>
      <form className="estado-form" id="estadoForm" onSubmit={consultar}>
        <input
          type="text"
          id="estadoFolio"
          placeholder="Folio (VTX-2026-001)"
          aria-label="Folio"
          autoComplete="off"
          value={folio}
          onChange={(e) => setFolio(e.target.value)}
        />
        <input
          type="email"
          id="estadoCorreo"
          placeholder="Correo registrado"
          aria-label="Correo registrado"
          value={correo}
          onChange={(e) => setCorreo(e.target.value)}
        />
        <button className="boton" type="submit">Consultar</button>
      </form>
      <div className={`estado-res${res.err ? " err" : ""}`} id="estadoRes" aria-live="polite">
        {res.texto}
      </div>
    </div>
  );
}
