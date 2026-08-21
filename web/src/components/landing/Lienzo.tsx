"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { crearMotor, type Motor, type TipoNodo } from "@/lib/motor/motor";

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
  onAbrirPanel: (tipo: TipoNodo, label: string) => void;
  onCerrarPanel: () => void;
  onVerIndice: () => void;
  carrusel: ReactNode;
}) {
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

  // el callback puede cambiar de identidad entre renders; el motor se monta
  // una sola vez, así que lo lee por referencia
  const abrir = useRef(onAbrirPanel);
  abrir.current = onAbrirPanel;
  const cerrar = useRef(onCerrarPanel);
  cerrar.current = onCerrarPanel;

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
        alAbrirPanel: (t, l) => abrir.current(t, l),
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

      <nav className="riel" ref={riel} aria-label="Progreso del recorrido">
        <button data-u="0" className="activo"><i></i><span>Vértices</span></button>
        <button data-u="0.48"><i></i><span>Temas</span></button>
        <button data-u="0.75"><i></i><span>Secciones</span></button>
        <button data-ir="convocatoria"><i></i><span>Publica</span></button>
      </nav>

      {/* capa 1: hero (el lienzo dibuja la palabra al centro; aqui solo margenes) */}
      <div className="capa" id="capaHero" ref={hero}>
        <div className="pista" aria-hidden="true"><i></i>Desplázate para explorar</div>
        <div className="hero-abajo">
          <p className="hero-etq">
            Revista académica de economía
            <span>Tecnológico de Monterrey · Campus Ciudad de México</span>
          </p>
          <div className="hero-edicion">
            <p>Edición inaugural · 2026</p>
            <a className="boton" href="#convocatoria" data-ir="convocatoria">Convocatoria abierta</a>
          </div>
        </div>
      </div>

      {/* capa 2: constelacion de temas */}
      <div className="capa" id="capaTemas" ref={temas}>
        <div className="temas-bloque">
          <p className="ceja">Constelación de conocimiento</p>
          <h2 className="titulo">Explora por <em>tema</em></h2>
          <p className="bajada">Veintisiete áreas de la economía, un nodo por tema. Haz clic en cualquier nodo para descubrir los artículos que orbitan a su alrededor.</p>
          <button className="boton" id="verIndice" type="button" onClick={onVerIndice}>Ver índice completo</button>
        </div>
        <p className="temas-pie">Arrastra para girar la red<br />Haz clic en un nodo para abrirlo</p>
      </div>

      {/* capa 3: mapa de secciones */}
      <div className="capa" id="capaSecciones" ref={secciones}>
        <div className="secciones-bloque">
          <p className="ceja">El mapa de la revista</p>
          <h2 className="titulo">Ocho secciones, un solo <em>recorrido</em></h2>
          <p className="bajada">De la carta editorial al cierre en comunidad. Pasa el cursor por un nodo para conocer su sección y haz clic para ver sus artículos.</p>
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
          <h2 className="titulo">¿Tienes una idea que merece <em>publicarse</em>?</h2>
          <div className="cierre-acciones">
            <a className="boton boton--lleno" href="#envio" data-ir="envio">Publica tu artículo</a>
            <a className="boton" href="#convocatoria" data-ir="convocatoria">Conoce el proceso</a>
          </div>
        </div>
      </div>

      {/* espaciador que gobierna el recorrido cinematografico */}
      <div id="recorrido" ref={recorrido} aria-hidden="true"></div>
    </>
  );
}
