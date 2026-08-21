"use client";

import { useRef } from "react";
import { ARTICULOS } from "@/lib/datos/articulos";
import { slug } from "@/lib/texto";

/**
 * Carrusel de artículos destacados. Marcado de index.html:662-671,
 * comportamiento de :2025-2035.
 *
 * Los enlaces apuntan a #articulo-<slug> y no llevan a ninguna parte: es
 * exactamente lo que hace el sitio actual (index.html:2027). Las páginas de
 * artículo llegan en la etapa 6.
 */

const DESTACADOS = ARTICULOS.filter((a) => a.dest);

export default function Carrusel() {
  const pista = useRef<HTMLDivElement>(null);

  const desplazar = (px: number) =>
    pista.current?.scrollBy({ left: px, behavior: "smooth" });

  return (
    <div className="carrusel-zona">
      <div className="carrusel-cab">
        <p className="ceja">Artículos destacados</p>
        <div className="flechas">
          <button
            className="flecha"
            id="cPrev"
            type="button"
            aria-label="Anterior"
            onClick={() => desplazar(-320)}
          >
            ←
          </button>
          <button
            className="flecha"
            id="cSig"
            type="button"
            aria-label="Siguiente"
            onClick={() => desplazar(320)}
          >
            →
          </button>
        </div>
      </div>
      <div className="carrusel" id="carrusel" ref={pista}>
        {DESTACADOS.map((a) => (
          <a className="tarjeta" key={a.t} href={`#articulo-${slug(a.t)}`}>
            <span className="tarjeta-sec">{a.s}</span>
            <h4>{a.t}</h4>
            <p>{a.a} · {a.min} min de lectura</p>
          </a>
        ))}
      </div>
    </div>
  );
}
