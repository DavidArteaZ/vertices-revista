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

/**
 * Las páginas satélite se capturan con prefers-reduced-motion: reduce.
 *
 * La etapa 1 asumió que su fondo animado era estable "porque el velo por
 * cuadro cambia menos de un paso de cuantización". Medido, es falso: dos
 * capturas seguidas de la misma página, con el generador ya sembrado, difieren
 * en ~140 000 píxeles. El campo de flujo acumula una estela por cuadro y el
 * número de cuadros antes de la captura depende de cuánto tardó la carga —
 * exactamente el mismo defecto que autoAng en el landing. La compuerta de la
 * etapa 1 pasó por suerte.
 *
 * La rama de movimiento reducido de fondo-flujo.js (líneas 126-130 del puerto)
 * corre 1100 pasos síncronos de dt fijo y se detiene, sin tocar rAF nunca. Con
 * el generador sembrado eso es bit a bit reproducible: legado contra legado da
 * 0 píxeles de diferencia. Y no es una rama muerta que sólo existe para las
 * pruebas: es lo que ve cualquier persona con el sistema en movimiento
 * reducido, así que la compuerta cubre código real.
 *
 * revelar.js:23 también sale temprano con movimiento reducido, de modo que
 * nunca añade la clase .rev y el contenido queda visible desde el principio —
 * el mismo estado final que forzar .rev-on.
 */
export const MOVIMIENTO_SATELITE = { reducedMotion: "reduce" } as const;

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

  // Reinicia el generador. __qa.runTo llama a resize() y por tanto a
  // buildParticles(), así que resembrar justo antes de cada captura
  // reconstruye TODAS las partículas desde un estado conocido.
  //
  // Hace falta porque la posición de cada partícula depende de cuántos
  // números aleatorios se consumieron antes, y eso varía entre el sitio
  // legado y el puerto: el original muestrea la palabra una vez con la
  // tipografía de reserva y otra cuando cargan las fuentes, y cada muestreo
  // produce un número distinto de puntos. Sin resembrar, la nube de
  // partículas de las fases de disolución nunca coincide.
  window.__resembrar = function () { a = ${SEMILLA} >>> 0; };

  Math.random = function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
})();
`;

/**
 * Sólo para el SITIO LEGADO.
 *
 * Anula el bucle de animación para que autoAng no acumule antes de la
 * captura: el motor auto-rota la constelación tras 3 s de inactividad
 * (index.html:1507-1511) y el ángulo dependería de cuánto tardó la página en
 * cargar. __qa.runTo no necesita rAF porque corre su propio bucle síncrono.
 *
 * NO se puede usar contra la app nueva: React 19 programa su render sobre
 * rAF, y sin él el componente del lienzo nunca monta. El puerto llega al
 * mismo estado por otra vía — su runTo pone autoAng en cero al empezar.
 */
export const guionSinRaf = `
(() => {
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
