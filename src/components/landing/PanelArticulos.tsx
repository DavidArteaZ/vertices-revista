"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import type { Articulo } from "@/lib/datos/articulos";
import { TOPICS } from "@/lib/datos/temas";
import { norm } from "@/lib/texto";
import { useCatalogo } from "@/i18n/catalogo";
import { useEsMovil } from "@/lib/dispositivo-cliente";
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
  /** Lo que se muestra: traducido. */
  valor: string | null;
  /**
   * El literal español con el que están indexados ARTICULOS.tm y .s. El
   * original sólo lleva el traducido (index.html:1920) y por eso, en
   * cualquier idioma que no sea español, articulosDe() no empareja nada y
   * todo tema se ve vacío. Se corrige aquí porque en la etapa 6 el panel lee
   * de la base de datos, donde el defecto dejaría de ser cosmético.
   */
  valor0: string | null;
  desdeIndice: boolean;
};

function articulosDe(articulos: Articulo[], tipo: ModoPanel, valor: string | null) {
  if (tipo === "tema") return articulos.filter((a) => a.tm.includes(valor!));
  if (tipo === "seccion") return articulos.filter((a) => a.s === valor);
  return articulos.slice();
}

export default function PanelArticulos({
  articulos,
  estado,
  onCerrar,
  onAbrirTema,
  onVolverIndice,
}: {
  articulos: Articulo[];
  estado: EstadoPanel | null;
  onCerrar: () => void;
  onAbrirTema: (traducido: string, espanol: string) => void;
  onVolverIndice: () => void;
}) {
  const t = useTranslations("panelarticulos");
  const cat = useCatalogo();
  const [filtro, setFiltro] = useState("");
  const busqueda = useRef<HTMLInputElement>(null);
  const abierto = estado !== null;
  const esMovil = useEsMovil();

  // Al cambiar de objetivo se limpia el filtro. Es el patrón de ajustar
  // estado durante el render que documenta React, no un efecto: llamar a
  // setState dentro de un efecto encadena un render de más.
  const objetivo = estado ? `${estado.tipo}|${estado.valor ?? ""}` : "";
  const [ultimoObjetivo, setUltimoObjetivo] = useState(objetivo);
  if (objetivo !== ultimoObjetivo) {
    setUltimoObjetivo(objetivo);
    setFiltro("");
  }

  // Enfocar la búsqueda al abrir, sin arrastrar el scroll. En un teléfono no:
  // el foco levanta el teclado y tapa media pantalla sin que nadie lo haya
  // pedido, así que ahí el foco se ofrece, no se toma.
  useEffect(() => {
    if (abierto && !esMovil) busqueda.current?.focus({ preventScroll: true });
  }, [abierto, objetivo, esMovil]);

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
      ? t("indice_de_temas")
      : estado.tipo === "tema"
        ? t("tema")
        : t("seccion_de_la_revista");
  const titulo = !estado ? "" : estado.tipo === "indice" ? t("todos_los_temas") : estado.valor!;

  // En escritorio la descripción de cada sección vive en la ficha que aparece
  // al pasar el cursor. En un teléfono no hay cursor y esa ficha no aparecería
  // nunca (movil.css la esconde), así que ahí la descripción entra bajo el
  // título de la hoja.
  const desc =
    esMovil && estado?.tipo === "seccion" && estado.valor0
      ? cat.descSeccion(estado.valor0)
      : "";

  // El filtro corre sobre el texto que la persona está leyendo, no sobre el
  // español que guarda el dato: buscar "trade" en inglés tiene que encontrar
  // Comercio Internacional.
  const temas = esIndice
    ? TOPICS.filter((x) => !f || norm(cat.tema(x)).includes(f))
    : [];
  let items = estado && !esIndice ? articulosDe(articulos, estado.tipo, estado.valor0) : [];
  if (f && !esIndice) items = items.filter((a) => norm(a.t + " " + a.a).includes(f));

  const cuentaArticulos = (n: number) =>
    n === 1 ? t("un_articulo") : t("n_articulos", { n });

  const meta = esIndice
    ? t("n_de_m_temas", { n: temas.length, m: TOPICS.length })
    : cuentaArticulos(items.length);

  return (
    <>
      <div id="fondoPanel" aria-hidden="true" onClick={onCerrar}></div>
      <aside id="panel" role="dialog" aria-modal="true" aria-labelledby="panelTitulo" aria-hidden={!abierto}>
        <header className="panel-cab">
          <div>
            <p className="ceja" id="panelCeja">{ceja}</p>
            <h3 id="panelTitulo">{titulo}</h3>
            <p className="panel-desc" id="panelDesc" hidden={!desc}>{desc}</p>
          </div>
          <button className="cierre" id="cerrarPanel" type="button" aria-label={t("cerrar_panel")} onClick={onCerrar}>✕</button>
        </header>
        <div className="panel-busca">
          <input
            type="text"
            id="panelBusqueda"
            ref={busqueda}
            placeholder={esIndice ? t("buscar_un_tema") : t("buscar_por_titulo_o_autor")}
            aria-label={t("buscar_articulos")}
            value={filtro}
            onChange={(e) => setFiltro(e.target.value)}
          />
        </div>
        <p className="panel-meta" id="panelMeta">{estado ? meta : ""}</p>
        <div id="panelLista">
          {esIndice &&
            temas.map((tema) => {
              const n = articulosDe(articulos, "tema", tema).length;
              return (
                <button className="ind" key={tema} data-tema={tema} onClick={() => onAbrirTema(cat.tema(tema), tema)}>
                  <span>{cat.tema(tema)}</span>
                  <span className="cuenta">{cuentaArticulos(n)}</span>
                </button>
              );
            })}

          {estado && !esIndice && (
            <>
              {estado.desdeIndice && (
                <button className="regresa" id="regresaIndice" onClick={onVolverIndice}>{t("regresar_al_indice")}</button>
              )}
              {items.length === 0 ? (
                <div className="vacio">
                  <p>{t("aun_no_hay_articulos_publicados_aqui")}</p>
                  <p>{t("se_la_primera_persona_en_escribir_sobre")}{" "}{estado.valor}{t("la_convocatoria_esta_abierta_y_el_comite_editori_c7be")}</p>
                </div>
              ) : (
                items.map((a) => (
                  <Link className="art" key={a.slug} href={`/articulos/${a.slug}`}>
                    <span className="art-sec">{cat.seccion(a.s)}{" "}·{" "}{a.min}{" "}{t("min_de_lectura")}</span>
                    <strong>{a.t}</strong>
                    <span className="art-aut">{a.a}</span>
                  </Link>
                ))
              )}
            </>
          )}
        </div>
        <footer className="panel-pie">
          <button className="boton boton--lleno" data-ir="envio" type="button">{t("publica_sobre_este_tema")}</button>
        </footer>
      </aside>
    </>
  );
}
