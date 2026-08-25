"use client";

import { useEffect, useRef, type RefObject } from "react";

/**
 * La barra superior se aparta al leer. Puerto de barra.js del sitio estático.
 *
 * SE ESCONDE al desplazarse hacia abajo —leyendo, no la necesitas y ocupa
 * pantalla— y VUELVE al desplazarse hacia arriba, que es el gesto de quien va
 * a navegar. Arriba del todo está siempre.
 *
 * Vale para las cuatro páginas con barra y para las dos versiones: es el mismo
 * componente, así que no consulta la versión del aparato.
 */

/* Umbral: por debajo de esto no cuenta como cambio de dirección. En un
   teléfono la barra de URL del navegador entra y sale al desplazarse y mueve
   el scroll unos píxeles sin que nadie lo pida; sin umbral, la barra entraría
   y saldría sola en cada gesto. */
const UMBRAL = 8;

export function useBarraQueSeAparta(
  barra: RefObject<HTMLElement | null>,
  menuAbierto: boolean,
) {
  // el manejador de scroll se monta una sola vez y lee el menú por referencia
  const menu = useRef(menuAbierto);
  useEffect(() => {
    menu.current = menuAbierto;
  });

  /* Abrir el menú trae la barra de vuelta pase lo que pase: el botón que lo
     abre vive en ella, así que si estuviera escondida el menú no se habría
     podido abrir, pero el estado puede cambiar por teclado o por un enlace. */
  useEffect(() => {
    if (menuAbierto) barra.current?.classList.remove("marco--fuera");
  }, [menuAbierto, barra]);

  useEffect(() => {
    const el = barra.current;
    if (!el) return;

    let ultimo = Math.max(0, window.scrollY);
    let escondida = false;
    let pendiente = false;

    const aplica = (esconder: boolean) => {
      if (esconder === escondida) return;
      escondida = esconder;
      el.classList.toggle("marco--fuera", esconder);
    };

    const revisa = () => {
      pendiente = false;
      const y = Math.max(0, window.scrollY);
      const dy = y - ultimo;

      /* Arriba del todo la barra siempre está: es donde se la busca. Sin esta
         excepción, el primer tirón hacia abajo la escondería antes de que
         nadie la hubiera visto. El margen es su propio alto. */
      if (y <= (el.offsetHeight || 64)) { ultimo = y; aplica(false); return; }

      if (Math.abs(dy) < UMBRAL) return;
      ultimo = y;

      /* Con el menú desplegado la barra no se mueve: el panel cuelga de ella y
         se iría con todo, dejando el menú abierto a medio aire. */
      if (menu.current) { aplica(false); return; }

      aplica(dy > 0);
    };

    const alDesplazar = () => {
      if (pendiente) return;
      pendiente = true;
      requestAnimationFrame(revisa);
    };

    addEventListener("scroll", alDesplazar, { passive: true });
    return () => {
      removeEventListener("scroll", alDesplazar);
      el.classList.remove("marco--fuera");
    };
  }, [barra]);
}
