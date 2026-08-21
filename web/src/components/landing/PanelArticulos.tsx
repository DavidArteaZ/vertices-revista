"use client";

import { useEffect, useRef, useState } from "react";
import { ARTICULOS } from "@/lib/datos/articulos";
import { TOPICS } from "@/lib/datos/temas";
import { norm, slug } from "@/lib/texto";
import type { TipoNodo } from "@/lib/motor/motor";

/**
 * Panel lateral de artículos por tema o sección.
 * Marcado de index.html:965-981, comportamiento de :1935-2004.
 *
 * El original repinta con innerHTML; aquí es estado de React. La conducta
 * observable se conserva al detalle: los mismos textos de conteo, el mismo
 * vacío, el mismo «Regresar al índice» sólo cuando se llegó desde el índice,
 * y la clase panel-abierto sobre el body, que es la que dispara el deslizado
 * en globals.css.
 */

export type ModoPanel = TipoNodo | "indice";

export type EstadoPanel = {
  tipo: ModoPanel;
  valor: string | null;
  desdeIndice: boolean;
};

function articulosDe(tipo: ModoPanel, valor: string | null) {
  if (tipo === "tema") return ARTICULOS.filter((a) => a.tm.includes(valor!));
  if (tipo === "seccion") return ARTICULOS.filter((a) => a.s === valor);
  return ARTICULOS.slice();
}

export default function PanelArticulos({
  estado,
  onCerrar,
  onAbrirTema,
  onVolverIndice,
}: {
  estado: EstadoPanel | null;
  onCerrar: () => void;
  onAbrirTema: (tema: string) => void;
  onVolverIndice: () => void;
}) {
  const [filtro, setFiltro] = useState("");
  const busqueda = useRef<HTMLInputElement>(null);
  const abierto = estado !== null;

  // al abrir: limpiar el filtro y enfocar la búsqueda sin arrastrar el scroll
  useEffect(() => {
    if (!abierto) return;
    setFiltro("");
    busqueda.current?.focus({ preventScroll: true });
  }, [abierto, estado?.tipo, estado?.valor]);

  useEffect(() => {
    document.body.classList.toggle("panel-abierto", abierto);
    return () => document.body.classList.remove("panel-abierto");
  }, [abierto]);

  useEffect(() => {
    const esc = (ev: KeyboardEvent) => {
      if (ev.key === "Escape") onCerrar();
    };
    document.addEventListener("keydown", esc);
    return () => document.removeEventListener("keydown", esc);
  }, [onCerrar]);

  const f = norm(filtro.trim());
  const esIndice = estado?.tipo === "indice";

  const ceja = !estado
    ? ""
    : estado.tipo === "indice"
      ? "Índice de temas"
      : estado.tipo === "tema"
        ? "Tema"
        : "Sección de la revista";
  const titulo = !estado ? "" : estado.tipo === "indice" ? "Todos los temas" : estado.valor!;

  const temas = esIndice ? TOPICS.filter((t) => !f || norm(t).includes(f)) : [];
  let items = estado && !esIndice ? articulosDe(estado.tipo, estado.valor) : [];
  if (f && !esIndice) items = items.filter((a) => norm(a.t + " " + a.a).includes(f));

  const meta = esIndice
    ? `${temas.length} de ${TOPICS.length} temas`
    : items.length === 1
      ? "1 artículo"
      : `${items.length} artículos`;

  return (
    <>
      <div id="fondoPanel" aria-hidden="true" onClick={onCerrar}></div>
      <aside id="panel" role="dialog" aria-modal="true" aria-labelledby="panelTitulo" aria-hidden={!abierto}>
        <header className="panel-cab">
          <div>
            <p className="ceja" id="panelCeja">{ceja}</p>
            <h3 id="panelTitulo">{titulo}</h3>
          </div>
          <button className="cierre" id="cerrarPanel" type="button" aria-label="Cerrar panel" onClick={onCerrar}>✕</button>
        </header>
        <div className="panel-busca">
          <input
            type="text"
            id="panelBusqueda"
            ref={busqueda}
            placeholder={esIndice ? "Buscar un tema" : "Buscar por título o autor"}
            aria-label="Buscar artículos"
            value={filtro}
            onChange={(e) => setFiltro(e.target.value)}
          />
        </div>
        <p className="panel-meta" id="panelMeta">{estado ? meta : ""}</p>
        <div id="panelLista">
          {esIndice &&
            temas.map((t) => {
              const n = articulosDe("tema", t).length;
              return (
                <button className="ind" key={t} data-tema={t} onClick={() => onAbrirTema(t)}>
                  <span>{t}</span>
                  <span className="cuenta">{n === 1 ? "1 artículo" : `${n} artículos`}</span>
                </button>
              );
            })}

          {estado && !esIndice && (
            <>
              {estado.desdeIndice && (
                <button className="regresa" id="regresaIndice" onClick={onVolverIndice}>← Regresar al índice</button>
              )}
              {items.length === 0 ? (
                <div className="vacio">
                  <p>Aún no hay artículos publicados aquí.</p>
                  <p>Sé la primera persona en escribir sobre {estado.valor}. La convocatoria está abierta y el comité editorial te acompaña en el proceso.</p>
                </div>
              ) : (
                items.map((a) => (
                  <a className="art" key={a.t} href={`#articulo-${slug(a.t)}`}>
                    <span className="art-sec">{a.s} · {a.min} min de lectura</span>
                    <strong>{a.t}</strong>
                    <span className="art-aut">{a.a}</span>
                  </a>
                ))
              )}
            </>
          )}
        </div>
        <footer className="panel-pie">
          <button className="boton boton--lleno" data-ir="envio" type="button">Publica sobre este tema</button>
        </footer>
      </aside>
    </>
  );
}
