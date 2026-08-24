"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { useTranslations } from "next-intl";
import { crearMotor, type Motor, type TipoNodo } from "@/lib/motor/motor";
import { useCatalogo } from "@/i18n/catalogo";

/**
 * Anfitrión del motor de partículas.
 *
 * Contiene el lienzo, las cuatro capas fijas del recorrido, el riel de
 * progreso, la ficha de sección y el espaciador de 680vh. Todo esto es DOM
 * posicionado que el motor muta por referencia; React sólo lo monta y lo
 * desmonta.
 *
 * No hay div .grano: el CSS define esa clase (index.html:75) pero el sitio
 * original nunca la usa en el marcado. Añadirla metería un grano visible que
 * no existe hoy.
 */
export default function Lienzo({
  onAbrirPanel,
  onCerrarPanel,
  onVerIndice,
  carrusel,
}: {
  onAbrirPanel: (tipo: TipoNodo, label: string, label0: string) => void;
  onCerrarPanel: () => void;
  onVerIndice: () => void;
  carrusel: ReactNode;
}) {
  const t = useTranslations("lienzo");
  const { traducir } = useCatalogo();
  const canvas = useRef<HTMLCanvasElement>(null);
  const recorrido = useRef<HTMLDivElement>(null);
  const velo = useRef<HTMLDivElement>(null);
  const hero = useRef<HTMLDivElement>(null);
  const temas = useRef<HTMLDivElement>(null);
  const secciones = useRef<HTMLDivElement>(null);
  const cierre = useRef<HTMLDivElement>(null);
  const ficha = useRef<HTMLDivElement>(null);
  const fsNombre = useRef<HTMLHeadingElement>(null);
  const fsDesc = useRef<HTMLParagraphElement>(null);
  const riel = useRef<HTMLElement>(null);

  // Los callbacks y el diccionario cambian de identidad entre renders; el
  // motor se monta una sola vez, así que los lee por referencia. La escritura
  // va dentro de un efecto: hacerla durante el render es un efecto secundario
  // y rompe con el render concurrente.
  const abrir = useRef(onAbrirPanel);
  const cerrar = useRef(onCerrarPanel);
  const tr = useRef(traducir);
  useEffect(() => {
    abrir.current = onAbrirPanel;
    cerrar.current = onCerrarPanel;
    tr.current = traducir;
  });

  useEffect(() => {
    let motor: Motor | undefined;
    let cancelado = false;

    // sampleTextPoints rasteriza "Vértices" para derivar cada partícula
    // (index.html:1189-1223). Montar antes de que carguen las tipografías
    // muestrea la fuente de reserva y sale otra palabra.
    document.fonts.ready.then(() => {
      if (cancelado || !canvas.current) return;
      motor = crearMotor({
        canvas: canvas.current,
        recorrido: recorrido.current!,
        capas: {
          hero: hero.current!,
          temas: temas.current!,
          secciones: secciones.current!,
          cierre: cierre.current!,
        },
        velo: velo.current!,
        ficha: {
          raiz: ficha.current!,
          nombre: fsNombre.current!,
          desc: fsDesc.current!,
        },
        rielBotones: Array.from(riel.current!.querySelectorAll("button")),
        traducir: (es) => tr.current(es),
        alAbrirPanel: (tipo, label, label0) => abrir.current(tipo, label, label0),
        alCerrarPanel: () => cerrar.current(),
      });
    });

    return () => {
      cancelado = true;
      motor?.destruir();
    };
  }, []);

  return (
    <>
      <canvas id="c" ref={canvas} aria-hidden="true"></canvas>
      <div className="vineta" aria-hidden="true"></div>
      <div id="velo" ref={velo} aria-hidden="true"></div>

      <nav className="riel" ref={riel} aria-label={t("progreso_del_recorrido")}>
        <button data-u="0" className="activo"><i></i><span>{t("vertices")}</span></button>
        <button data-u="0.48"><i></i><span>{t("temas")}</span></button>
        <button data-u="0.75"><i></i><span>{t("secciones")}</span></button>
        <button data-ir="convocatoria"><i></i><span>{t("publica")}</span></button>
      </nav>

      {/* capa 1: hero (el lienzo dibuja la palabra al centro; aqui solo margenes) */}
      <div className="capa" id="capaHero" ref={hero}>
        <div className="pista" aria-hidden="true"><i></i>{t("desplazate_para_explorar")}</div>
        <div className="hero-abajo">
          <p className="hero-etq">{t("revista_academica_de_economia")}<span>{t("tecnologico_de_monterrey_campus_ciudad_de_mexico")}</span>
          </p>
          <div className="hero-edicion">
            <p>{t("edicion_inaugural_2026")}</p>
            <a className="boton" href="#convocatoria" data-ir="convocatoria">{t("convocatoria_abierta")}</a>
          </div>
        </div>
      </div>

      {/* capa 2: constelacion de temas */}
      <div className="capa" id="capaTemas" ref={temas}>
        <div className="temas-bloque">
          <p className="ceja">{t("constelacion_de_conocimiento")}</p>
          <h2 className="titulo">{t("explora_por")}{" "}<em>{t("tema")}</em></h2>
          <p className="bajada">{t("veintisiete_areas_de_la_economia_un_nodo_por_tem_a6a3")}</p>
          <button className="boton" id="verIndice" type="button" onClick={onVerIndice}>{t("ver_indice_completo")}</button>
        </div>
        <p className="temas-pie">{t("arrastra_para_girar_la_red")}<br />{t("haz_clic_en_un_nodo_para_abrirlo")}</p>
      </div>

      {/* capa 3: mapa de secciones */}
      <div className="capa" id="capaSecciones" ref={secciones}>
        <div className="secciones-bloque">
          <p className="ceja">{t("el_mapa_de_la_revista")}</p>
          <h2 className="titulo">{t("ocho_secciones_un_solo")}{" "}<em>{t("recorrido")}</em></h2>
          <p className="bajada">{t("de_la_carta_editorial_al_cierre_en_comunidad_pas_7503")}</p>
        </div>
        {carrusel}
      </div>

      {/* ficha flotante de la seccion bajo el cursor */}
      <div id="fichaSeccion" ref={ficha} aria-hidden="true">
        <h3 id="fsNombre" ref={fsNombre}></h3>
        <p id="fsDesc" ref={fsDesc}></p>
      </div>

      {/* capa 4: cierre del recorrido e invitacion a publicar */}
      <div className="capa" id="capaCierre" ref={cierre}>
        <div className="cierre-bloque">
          <h2 className="titulo">{t("tienes_una_idea_que_merece")}{" "}<em>{t("publicarse")}</em>?</h2>
          <div className="cierre-acciones">
            <a className="boton boton--lleno" href="#envio" data-ir="envio">{t("publica_tu_articulo")}</a>
            <a className="boton" href="#convocatoria" data-ir="convocatoria">{t("conoce_el_proceso")}</a>
          </div>
        </div>
      </div>

      {/* espaciador que gobierna el recorrido cinematografico */}
      <div id="recorrido" ref={recorrido} aria-hidden="true"></div>
    </>
  );
}
