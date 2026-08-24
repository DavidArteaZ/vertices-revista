"use client";

import { useEffect } from "react";

/**
 * Revelado por scroll de las páginas satélite: las secciones, tarjetas y
 * filas entran con un desvanecimiento ascendente escalonado. Portado de
 * revelar.js.
 *
 * Sin IntersectionObserver a propósito, igual que el original: usa posición y
 * scroll para funcionar en cualquier navegador, y la clase .rev sólo se
 * aplica a elementos ya registrados aquí, así que la página nunca puede
 * quedarse invisible. Respeta prefers-reduced-motion.
 */

// Acoplamiento explícito: si alguna de estas clases se renombra en el CSS o
// en el marcado, el revelado deja de aplicarse en silencio.
export const OBJETIVOS = [
  ".hero-cont > *",
  "main > .ceja", "main > h1", "main > .entrada",
  "section > .ceja", "section > h2", "section > .texto",
  ".valores .valor", ".niveles .nivel",
  ".generales > li", ".integridad > li",
  ".acordeon details",
  ".tabla-scroll", ".fuente-nota", ".umbral", ".cierre",
  "footer.pie .pie-rejilla > div",
].join(", ");

export default function Revelar() {
  useEffect(() => {
    const els = Array.from(document.querySelectorAll<HTMLElement>(OBJETIVOS));
    if (!els.length) return;
    if (matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    // escalonado por hermanos dentro del mismo padre
    const porPadre = new Map<Element | null, number>();
    for (const el of els) {
      const n = porPadre.get(el.parentElement) || 0;
      porPadre.set(el.parentElement, n + 1);
      el.classList.add("rev");
      el.style.transitionDelay = `${Math.min(n * 70, 420)}ms`;
    }

    let pendientes = els.slice();
    let programado = false;
    let temporizador: ReturnType<typeof setTimeout>;

    function chequea() {
      programado = false;
      // visores raros pueden reportar altura 0; nunca dejar el umbral en cero
      const alto = Math.max(innerHeight, document.documentElement.clientHeight || 0, 640);
      const limite = alto * 0.92;
      pendientes = pendientes.filter((el) => {
        const r = el.getBoundingClientRect();
        // detalles cerrados u ocultos: alto 0, se revelan al aparecer
        if (r.height === 0 && r.width === 0) return true;
        if (r.top < limite && r.bottom > 0) {
          el.classList.add("rev-on");
          return false;
        }
        return true;
      });
      if (!pendientes.length) desmontar();
    }

    function pide() {
      if (!programado) {
        programado = true;
        temporizador = setTimeout(chequea, 40);
      }
    }

    function desmontar() {
      removeEventListener("scroll", pide);
      removeEventListener("resize", pide);
      document.removeEventListener("toggle", pide, true);
    }

    addEventListener("scroll", pide, { passive: true });
    addEventListener("resize", pide);
    // acordeones: al abrir un details, revisar de nuevo
    document.addEventListener("toggle", pide, true);
    // primera pasada al cargar (y otra cuando las fuentes ajustan el layout)
    pide();
    const segunda = setTimeout(pide, 350);

    return () => {
      desmontar();
      clearTimeout(temporizador);
      clearTimeout(segunda);
    };
  }, []);

  return null;
}
