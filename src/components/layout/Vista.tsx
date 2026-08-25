"use client";

import { useEffect, useLayoutEffect } from "react";

/**
 * Sostiene `data-disp` en <html> a lo largo de toda la vida de la página.
 *
 * El guion del <head> lo estampa antes de pintar, y eso basta para la primera
 * carga. Lo que no basta es para el resto: `<html>` lo renderiza el layout de
 * /[locale], así que cambiar de idioma lo desmonta y lo vuelve a montar, y al
 * montarlo React le fija los atributos que él conoce —`lang`— y se lleva por
 * delante el que no. El síntoma en un teléfono era brutal y silencioso: elegir
 * otro idioma devolvía la maqueta de escritorio, porque movil.css entero
 * cuelga de `html[data-disp="movil"]`.
 *
 * Se repone en cada render, no una sola vez al montar: el remonte del layout
 * es exactamente el caso que hay que cubrir.
 *
 * Va en efecto de DISPOSICIÓN y no en `useEffect` a propósito: los de
 * disposición corren antes de que el navegador pinte, así que el atributo
 * vuelve dentro del mismo cuadro y no se ve el parpadeo a maqueta ancha. En el
 * servidor no hay disposición que valga, y React avisa si se le pide allí, así
 * que fuera del navegador se usa el otro.
 */
const efectoAntesDePintar = typeof window === "undefined" ? useEffect : useLayoutEffect;

export default function Vista() {
  efectoAntesDePintar(() => {
    const raiz = document.documentElement;
    const vista = window.VERTICES_MOVIL ? "movil" : "escritorio";
    if (raiz.dataset.disp !== vista) raiz.dataset.disp = vista;
  });

  return null;
}
