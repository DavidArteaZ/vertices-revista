"use client";

import { useEffect, useRef } from "react";

/**
 * Fondo de las páginas satélite: campo de flujo congelado. Partículas
 * invisibles siguen líneas de corriente fijas dejando estelas muy tenues de
 * tinta; cada cuadro repinta un velo crema translúcido, así las estelas se
 * acumulan en curvas largas y continuas. Portado de fondo-flujo.js.
 *
 * El dibujo dura diez segundos y se congela: pasado ese punto el mapa ya está
 * formado. En teléfono ni siquiera se anima —se acumula de una pasada— y la
 * densidad baja de 1800 partículas a 240.
 *
 * ÚNICO cambio real del stage: el original antepone su lienzo al <body> y
 * después recorre document.body.children asignando position/z-index en línea
 * a TODOS los hermanos (fondo-flujo.js:9-20). Bajo Next ese conjunto incluye
 * nodos que inyecta el framework, y React pelea con los estilos en línea al
 * hidratar. Aquí el lienzo trae su propio contexto de apilamiento y la página
 * envuelve su contenido en un contenedor con z-index 1; el resultado visual
 * es el mismo sin tocar nodos ajenos.
 */

const CREMA = [231, 222, 203];
const TINTA = "45,35,46";
const ACENTOS = ["77,77,250", "253,99,67", "119,118,207"];

const VELO = 0.035;       // velo crema por cuadro: casi nulo = estelas casi permanentes
const OP_TINTA = 0.018;   // trazos finos (el estipulado de fondo)
const OP_LIDER = 0.035;   // trazos líderes (curvas largas y visibles)
const OP_ACENTO = 0.045;  // trazos con destello de color
const PROB_LIDER = 0.25;
const PROB_ACENTO = 0.04;
const VIDA_MIN = 500,
  VIDA_MAX = 1300;

/* El fondo tiene principio y fin. Se dibuja durante diez segundos y se
   congela: pasado ese punto el mapa ya está formado y seguir animándolo no
   añade nada, sólo gasta batería. El presupuesto va por TIEMPO REAL y no por
   cuadros, para que sean diez segundos exactos vaya la pantalla a 60Hz o a
   120Hz; el último tramo sólo aclara, sin tinta nueva, así el fondo converge
   a un estado más claro antes de quedarse quieto. */
const DURACION_ANIMACION_MS = 10000;
const DURACION_ENFRIAMIENTO_MS = 1500;
const DURACION_DIBUJO_MS = DURACION_ANIMACION_MS - DURACION_ENFRIAMIENTO_MS;

type Particula = {
  x: number; y: number; px: number; py: number;
  vida: number; color: string; op: number; vel: number; ancho: number;
};

export default function FondoFlujo() {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const lienzo = ref.current;
    if (!lienzo) return;
    const ctx = lienzo.getContext("2d")!;
    const quieto = matchMedia("(prefers-reduced-motion: reduce)").matches;
    /* En teléfono el campo se acumula una vez y el bucle no arranca: la
       textura se ve igual —el campo está congelado, las estelas sólo se van
       sumando— y el aparato no gasta batería animando un fondo durante toda
       la visita. */
    const movil = !!window.VERTICES_MOVIL;
    const estatico = quieto || movil;

    let W = 0, H = 0, dpr = 1;
    let particulas: Particula[] = [];
    let raf = 0;
    let ultimo = 0;
    let inicioMs = 0;
    let temporizador: ReturnType<typeof setTimeout>;

    function medir() {
      dpr = Math.min(devicePixelRatio || 1, 2);
      W = innerWidth; H = innerHeight;
      lienzo!.width = W * dpr; lienzo!.height = H * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.fillStyle = `rgb(${CREMA.join(",")})`;
      ctx.fillRect(0, 0, W, H);
    }

    // campo de flujo CONGELADO: ondas de muy baja frecuencia = canales
    // laminares amplios; al no depender del tiempo las líneas de corriente
    // son fijas y las estelas se acumulan en curvas largas y limpias
    function angulo(x: number, y: number) {
      return (
        Math.sin(x * 0.0015 + 0.6) * 2.0 +
        Math.cos(y * 0.0019 - 0.4) * 1.9 +
        Math.sin((x - y) * 0.0011) * 0.8
      );
    }

    function nace(p: Partial<Particula>): Particula {
      const acento = Math.random() < PROB_ACENTO;
      const lider = !acento && Math.random() < PROB_LIDER;
      p.x = Math.random() * W; p.y = Math.random() * H; p.px = p.x; p.py = p.y;
      p.vida = (VIDA_MIN + Math.random() * (VIDA_MAX - VIDA_MIN)) | 0;
      if (acento) { p.color = ACENTOS[(Math.random() * ACENTOS.length) | 0]; p.op = OP_ACENTO; p.vel = 40 + Math.random() * 90; p.ancho = 0.7; }
      else if (lider) { p.color = TINTA; p.op = OP_LIDER; p.vel = 80 + Math.random() * 120; p.ancho = 0.85; }
      else { p.color = TINTA; p.op = OP_TINTA; p.vel = 14 + Math.pow(Math.random(), 1.8) * 110; p.ancho = 0.6; }
      return p as Particula;
    }

    function siembra() {
      // densidad moderada: el techo de 4200 cubría casi toda la pantalla de
      // tinta en pocos cuadros. En teléfono baja todavía más —menos
      // partículas, menos batería— porque además el mapa se acumula de una
      // sola pasada.
      const n = movil
        ? Math.round(Math.min(240, Math.max(180, (W * H) / 1300)))
        : Math.round(Math.min(1800, Math.max(500, (W * H) / 900)));
      particulas = Array.from({ length: n }, () => nace({}));
      particulas.forEach((p) => { p.vida = (p.vida * Math.random()) | 0; });
    }

    // dibujando=false → fase de enfriamiento: sólo se aplica el velo, sin
    // añadir tinta nueva
    function paso(dt: number, dibujando: boolean) {
      ctx.globalAlpha = 1;
      ctx.fillStyle = `rgba(${CREMA.join(",")},${VELO})`;
      ctx.fillRect(0, 0, W, H);

      if (!dibujando) return;

      ctx.lineCap = "round";
      for (const p of particulas) {
        p.px = p.x; p.py = p.y;
        const th = angulo(p.x, p.y);
        p.x += Math.cos(th) * p.vel * dt;
        p.y += Math.sin(th) * p.vel * dt;
        let salto = false;
        if (p.x < -20) { p.x = W + 20; salto = true; } else if (p.x > W + 20) { p.x = -20; salto = true; }
        if (p.y < -20) { p.y = H + 20; salto = true; } else if (p.y > H + 20) { p.y = -20; salto = true; }
        if (--p.vida <= 0) { nace(p); continue; }
        if (salto) { p.px = p.x; p.py = p.y; continue; }
        ctx.strokeStyle = `rgba(${p.color},${p.op})`;
        ctx.lineWidth = p.ancho;
        ctx.beginPath();
        ctx.moveTo(p.px, p.py);
        ctx.lineTo(p.x, p.y);
        ctx.stroke();
      }
    }

    function ciclo(ms: number) {
      const dt = Math.min(0.05, (ms - ultimo) / 1000 || 0.016);
      ultimo = ms;

      const transcurrido = ms - inicioMs;
      paso(dt, transcurrido < DURACION_DIBUJO_MS);

      // se cumplieron los 10s: el último cuadro pintado queda fijo
      if (transcurrido >= DURACION_ANIMACION_MS) return;

      raf = requestAnimationFrame(ciclo);
    }

    let primerArranque = true;

    function arranca() {
      cancelAnimationFrame(raf);
      // Gancho de QA, del mismo tipo que window.__qa del motor (spec §4.1).
      // Sólo existe cuando la prueba visual lo inyecta; en producción esto es
      // una llamada a undefined que el encadenamiento opcional descarta.
      //
      // Hace falta porque el campo de flujo se siembra con Math.random y su
      // resultado depende de cuántos números se consumieron antes. En el sitio
      // legado fondo-flujo.js corre casi al principio del documento; aquí corre
      // dentro de un efecto, después de que React hidrata. Sin resembrar aquí,
      // las dos siembras arrancan en puntos distintos del flujo y salen dos
      // mapas distintos, ambos plausibles y ninguno comparable.
      //
      // SÓLO en el primer arranque. El legado no resiembra al redimensionar, y
      // una captura de página completa redimensiona el viewport: si aquí se
      // resembrara otra vez, los dos lados volverían a divergir justo antes
      // de la foto. Se notó en lineamientos, la página más alta, donde el
      // rebote de 200 ms del resize alcanza a dispararse.
      if (primerArranque) {
        (window as { __resembrar?: () => void }).__resembrar?.();
        primerArranque = false;
      }
      medir();
      siembra();
      if (estatico) {
        // sin animar: reproduce igual el presupuesto de 10s de golpe y se
        // queda en el estado final ya aclarado. En teléfono se recorta la fase
        // de dibujo (el enfriamiento no): el mapa ya viene con muchas menos
        // partículas, así que no hace falta acumular tanto.
        const dtFijo = 0.033;
        const cuadrosDibujo = Math.round(
          (DURACION_DIBUJO_MS * (movil ? 0.55 : 1)) / (dtFijo * 1000),
        );
        const cuadrosEnfriamiento = Math.round(DURACION_ENFRIAMIENTO_MS / (dtFijo * 1000));
        for (let i = 0; i < cuadrosDibujo; i++) paso(dtFijo, true);
        for (let i = 0; i < cuadrosEnfriamiento; i++) paso(dtFijo, false);
        return;
      }
      ultimo = performance.now();
      inicioMs = ultimo;
      raf = requestAnimationFrame(ciclo);
    }

    let anchoPrevio = innerWidth;
    const alRedimensionar = () => {
      // la barra de URL del teléfono entra y sale al desplazarse, y cada
      // cambio de alto dispara resize: si eso recalculara el mapa, el fondo
      // parpadearía en cada gesto. Sólo se rehace al girar el aparato.
      if (movil && innerWidth === anchoPrevio) return;
      anchoPrevio = innerWidth;
      clearTimeout(temporizador);
      temporizador = setTimeout(arranca, 200);
    };
    addEventListener("resize", alRedimensionar);
    arranca();

    return () => {
      cancelAnimationFrame(raf);
      clearTimeout(temporizador);
      removeEventListener("resize", alRedimensionar);
    };
  }, []);

  return (
    <canvas
      ref={ref}
      aria-hidden="true"
      style={{ position: "fixed", inset: 0, width: "100%", height: "100%", pointerEvents: "none", zIndex: 0 }}
    />
  );
}
