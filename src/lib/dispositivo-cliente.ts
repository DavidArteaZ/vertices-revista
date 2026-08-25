"use client";

import { useSyncExternalStore } from "react";

import { ANCHO_MOVIL, type Vista } from "./dispositivo";

/**
 * Lee la versión que resolvió el guion del <head> (ver src/lib/dispositivo.ts).
 *
 * En el servidor y en el primer render devuelve `false`: la portada se
 * prerrenderiza una sola vez para todos los aparatos, así que el HTML no puede
 * afirmar nada sobre la pantalla sin desincronizar la hidratación. El valor
 * real llega tras montar y provoca un segundo render.
 *
 * Por eso todo lo que se pueda resolver con CSS —maquetación, tipografía,
 * qué texto se enseña— se resuelve en movil.css con `html[data-disp="movil"]`,
 * que sí está en su sitio antes del primer pixel. Este hook queda para lo que
 * sólo sabe hacer JavaScript: la geometría del motor, el cajón de destacados y
 * el foco del buscador.
 *
 * No se suscribe a nada porque la versión no cambia sin recargar: cruzar el
 * umbral redimensionando dispara `location.reload()`.
 */
const sinCambios = () => () => {};

export function useEsMovil(): boolean {
  return useSyncExternalStore(
    sinCambios,
    () => document.documentElement.dataset.disp === "movil",
    () => false,
  );
}

/**
 * La vuelta.
 *
 * La preferencia de versión se recuerda, y eso convertía la elección manual en
 * una puerta de un solo sentido: la versión de teléfono ofrece "Ver versión de
 * escritorio" en el pie, y la de escritorio no ofrecía nada para volver. Quien
 * fijara escritorio en un teléfono se quedaba con la maqueta ancha para
 * siempre, sin saber que ?vista=auto existe.
 *
 * Devuelve a qué versión se ofrece cambiar, o `null` cuando no hace falta
 * ofrecer nada: en una computadora no sale, y si la de escritorio se está
 * viendo porque toca —y no porque alguien la fijó— tampoco.
 */
function destinoActual(): Vista | null {
  if (document.documentElement.dataset.disp === "movil") return "escritorio";
  if (
    window.VERTICES_VISTA_FORZADA === "escritorio" &&
    matchMedia(`(max-width:${ANCHO_MOVIL}px)`).matches
  ) {
    return "movil";
  }
  return null;
}

export function useCambioDeVista() {
  const destino = useSyncExternalStore(sinCambios, destinoActual, () => null);
  return { destino, cambiar: (vista: Vista) => window.VERTICES_CAMBIA_VISTA?.(vista) };
}
