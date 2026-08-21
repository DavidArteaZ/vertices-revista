export const LOCALES = ["es", "en", "fr", "it", "pt", "ru"] as const;

// Un punto por fase del recorrido (PH en index.html:1072-1082), elegidos al
// centro de cada fase para no caer en una frontera donde el texto de las
// secciones está a media máquina de escribir.
export const PUNTOS_U = [0, 0.2, 0.3, 0.48, 0.6, 0.75, 0.9, 1] as const;

export const SATELITES = [
  { ruta: "/lineamientos", legado: "lineamientos.html", nombre: "lineamientos" },
  { ruta: "/quienes-somos", legado: "quienes-somos.html", nombre: "quienes-somos" },
  { ruta: "/equipo", legado: "equipo-ds.html", nombre: "equipo-ds" },
] as const;

export const nombreU = (u: number) => String(u).replace(".", "_");

/**
 * El motor coloca los 27 nodos de la constelación con Math.random
 * (buildNetwork, index.html:1252-1298), y también decide tintes, semillas de
 * partícula, cuentas de las aristas y qué aristas largas añadir. Sin sembrar
 * el generador, cada carga produce una red distinta y ninguna captura se
 * puede reproducir.
 *
 * Sembrarlo hace algo más que estabilizar: obliga a que el puerto consuma los
 * números aleatorios en el MISMO orden que el original. Si buildNetwork pide
 * un valor de más o de menos, la red sale distinta y la prueba lo detecta.
 */
export const SEMILLA = 0x5eed1234;

export const guionSemilla = `
(() => {
  let a = ${SEMILLA} >>> 0;
  Math.random = function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };

  // El bucle de animación se anula por completo. El motor auto-rota la
  // constelación tras 3 s de inactividad acumulando autoAng en cada cuadro
  // (index.html:1507-1511), así que el ángulo de la red al momento de la
  // captura depende de cuánto tardó la página en cargar: irreproducible.
  //
  // __qa.runTo no necesita rAF — corre su propio bucle síncrono de
  // update/render — así que anularlo deja el motor totalmente gobernado por
  // la prueba, con autoAng en 0 y rotIdle en su valor inicial.
  window.requestAnimationFrame = function () { return 0; };
  window.cancelAnimationFrame = function () {};
})();
`;

export const PUERTO_LEGADO = 4399;
export const PUERTO_APP = 3100;

/**
 * Instante fijo para el reloj falso. Con el reloj instalado y sin avanzarlo,
 * requestAnimationFrame nunca dispara, así que el bucle frame() no corre y
 * rotIdle/autoAng se quedan en su valor inicial.
 *
 * Hace falta porque el motor auto-rota la constelación tras 3 s de inactividad
 * (index.html:1507-1511): autoAng acumula en cada cuadro real, de modo que el
 * ángulo de la red al llamar __qa.runTo depende de cuánto tardó la página en
 * cargar. Diferencia pequeña — unos 6000 píxeles — pero irreproducible.
 */
export const INSTANTE_FIJO = new Date("2026-01-01T12:00:00.000Z");
