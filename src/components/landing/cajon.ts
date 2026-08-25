"use client";

import { useEffect, type RefObject } from "react";

/**
 * Los destacados, como cajón. Puerto de la parte de movil.js que lo gobierna.
 *
 * El carrusel de destacados tapaba la red neuronal en la pantalla de
 * secciones. Ahora asoma a la mitad y se saca con el dedo. La clase `.m-cajon`
 * la pone este gancho y no la hoja de estilos a propósito: sin JavaScript el
 * carrusel se ve entero como siempre, en vez de quedarse a medias y sin forma
 * de abrirse.
 *
 * El estado vive en el DOM y no en React: entre `pointerdown` y `pointerup`
 * la altura la fija el dedo cuadro a cuadro, y pasar eso por un `useState`
 * sería un render por movimiento.
 */

/** lo que se ve en reposo; el mismo valor que el max-height de movil.css */
const ASOMA = 118;

export function useCajonDestacados(
  zona: RefObject<HTMLDivElement | null>,
  cinta: RefObject<HTMLDivElement | null>,
  tirador: RefObject<HTMLButtonElement | null>,
  activo: boolean,
) {
  useEffect(() => {
    const caja = zona.current;
    const pista = cinta.current;
    const asa = tirador.current;
    if (!activo || !caja || !pista || !asa) return;

    caja.classList.add("m-cajon");

    let abierto = false, tope = 0, dy = 0;
    let x0 = 0, y0 = 0, arrastrando = false, decidido = false;

    const mide = () => { tope = Math.max(ASOMA + 40, pista.scrollHeight + 6); };

    const asienta = (ab: boolean) => {
      abierto = ab;
      caja.classList.toggle("abierto", ab);
      pista.style.maxHeight = "";          // la altura vuelve a mandarla el CSS
      asa.setAttribute("aria-expanded", ab ? "true" : "false");
    };

    const empieza = (ev: PointerEvent) => {
      mide();
      x0 = ev.clientX; y0 = ev.clientY; dy = 0;
      arrastrando = true; decidido = false;
      caja.classList.add("arrastrando");
    };

    const mueve = (ev: PointerEvent) => {
      if (!arrastrando) return;
      const ax = ev.clientX - x0, ay = ev.clientY - y0;
      if (!decidido) {
        // el gesto iba de lado: es el carrusel, no el cajón
        if (Math.abs(ax) > Math.abs(ay) && Math.abs(ax) > 6) {
          arrastrando = false;
          caja.classList.remove("arrastrando");
          return;
        }
        if (Math.abs(ay) < 6) return;
        decidido = true;
      }
      dy = ay;
      // hacia arriba (ay negativo) el cajón crece
      const base = abierto ? tope : ASOMA;
      pista.style.maxHeight = Math.max(ASOMA, Math.min(tope, base - dy)) + "px";
    };

    const suelta = () => {
      if (!arrastrando) return;
      arrastrando = false;
      caja.classList.remove("arrastrando");
      if (!decidido) { pista.style.maxHeight = ""; return; }
      const base = abierto ? tope : ASOMA;
      const altura = Math.max(ASOMA, Math.min(tope, base - dy));
      // se queda donde esté más cerca, con el punto de corte a un tercio
      asienta(altura > ASOMA + (tope - ASOMA) / 3);
    };

    // tocar el tirador también lo abre y lo cierra
    const alTocar = () => { if (!decidido) asienta(!abierto); };

    caja.addEventListener("pointerdown", empieza);
    caja.addEventListener("pointermove", mueve);
    caja.addEventListener("pointerup", suelta);
    caja.addEventListener("pointercancel", suelta);
    asa.addEventListener("click", alTocar);

    return () => {
      caja.removeEventListener("pointerdown", empieza);
      caja.removeEventListener("pointermove", mueve);
      caja.removeEventListener("pointerup", suelta);
      caja.removeEventListener("pointercancel", suelta);
      asa.removeEventListener("click", alTocar);
      caja.classList.remove("m-cajon", "abierto", "arrastrando");
      pista.style.maxHeight = "";
    };
  }, [activo, zona, cinta, tirador]);
}
