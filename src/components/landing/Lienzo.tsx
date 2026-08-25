"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { useTranslations } from "next-intl";
import { crearMotor, type Motor, type TipoNodo } from "@/lib/motor/motor";
import { useCatalogo } from "@/i18n/catalogo";

/* Los cuatro iconos de la barra de pestañas del teléfono, en el mismo orden
   que las paradas del riel. En escritorio el punto de 7px se basta solo y
   globals.css esconde el <svg>; abajo, convertido en pestaña, un punto no
   dice nada. El trazo, el relleno y el grosor los pone movil.css. */
const ICONOS = [
  <g key="vertices">
    <path d="M12 3 20.5 19.5 3.5 19.5Z" />
    <path d="M12 3 12.8 13.2 3.5 19.5M12.8 13.2 20.5 19.5" opacity=".55" />
  </g>,
  <g key="temas">
    <circle cx="12" cy="5.4" r="2" />
    <circle cx="5" cy="16.5" r="2" />
    <circle cx="19" cy="16.5" r="2" />
    <path d="M10.7 7.1 6.3 14.8M13.3 7.1 17.7 14.8M7 16.5h10" />
  </g>,
  <g key="secciones">
    <path d="M4 6.5h16M4 12h16M4 17.5h10" />
  </g>,
  <g key="publica">
    <path d="M12 15.5V4.5M8.2 8.3 12 4.5l3.8 3.8" />
    <path d="M4.5 14.5v3.4a1.6 1.6 0 0 0 1.6 1.6h11.8a1.6 1.6 0 0 0 1.6-1.6v-3.4" />
  </g>,
];

const Icono = ({ i }: { i: number }) => (
  <svg viewBox="0 0 24 24" aria-hidden="true">{ICONOS[i]}</svg>
);

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
        <button data-u="0" className="activo"><i><Icono i={0} /></i><span>{t("vertices")}</span></button>
        <button data-u="0.48"><i><Icono i={1} /></i><span>{t("temas")}</span></button>
        <button data-u="0.75"><i><Icono i={2} /></i><span>{t("secciones")}</span></button>
        <button data-ir="convocatoria" className="riel--cta"><i><Icono i={3} /></i><span>{t("publica")}</span></button>
      </nav>

      {/* capa 1: hero (el lienzo dibuja la palabra al centro; aqui solo margenes) */}
      <div className="capa" id="capaHero" ref={hero}>
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
          <p className="bajada solo-escritorio">{t("veintisiete_areas_de_la_economia_un_nodo_por_tem_a6a3")}</p>
          <p className="bajada solo-movil">{t("veintisiete_areas_de_la_economia_toca_un_tema_pa_5b1c")}</p>
          <button className="boton" id="verIndice" type="button" onClick={onVerIndice}>{t("ver_indice_completo")}</button>
        </div>
        <p className="temas-pie">{t("arrastra_para_girar_la_red")}<br />{t("haz_clic_en_un_nodo_para_abrirlo")}</p>
      </div>

      {/* capa 3: mapa de secciones */}
      <div className="capa" id="capaSecciones" ref={secciones}>
        <div className="secciones-bloque">
          <p className="ceja">{t("el_mapa_de_la_revista")}</p>
          <h2 className="titulo">{t("ocho_secciones_un_solo")}{" "}<em>{t("recorrido")}</em></h2>
          <p className="bajada solo-escritorio">{t("de_la_carta_editorial_al_cierre_en_comunidad_pas_7503")}</p>
          <p className="bajada solo-movil">{t("de_la_carta_editorial_al_cierre_en_comunidad_toc_9e77")}</p>
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
