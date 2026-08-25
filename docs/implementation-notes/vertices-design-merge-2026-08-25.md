# Implementation notes — merge de diseño desde lec-cdmx/vertices

- **Spec**: n/a (petición directa: traer el diseño de `lec-cdmx/vertices` y
  `eliassmota/vertices` a este repositorio, sin tocar lo técnico del panel,
  Supabase ni Resend)
- **Plan**: n/a
- **Started**: 2026-08-25

## Punto de partida

`legado/` de este repositorio corresponde a `1c8a0cb` del sitio estático, el
commit **anterior** a `af788e1` ("Agregar versión de teléfono"). Todo el
trabajo de diseño de Elías y Yununen (24 commits) quedó fuera del port a
Next.js. `eliassmota/vertices@main` (`8b18984`) es ancestro de
`lec-cdmx/vertices@main` (`104892f`): no aporta nada que no esté ya en
lec-cdmx, sólo sirve como historia.

## Decisiones fuera del encargo

- **`dispositivo.js` se porta como guion en línea en el `<head>`**, no como
  efecto de React. Tiene que correr antes del primer pixel o el teléfono
  alcanza a pintar un cuadro con la maqueta de escritorio. Un `<Script>` de
  Next, incluso con `strategy="beforeInteractive"`, no da esa garantía dentro
  de `<head>`.
- **Todo lo que se puede resolver en CSS, se resuelve en CSS.** La portada se
  prerrenderiza una sola vez para todos los aparatos, así que el HTML no puede
  afirmar nada sobre la pantalla sin desincronizar la hidratación. Los dos
  textos que `movil.js` reescribía (las bajadas de temas y de secciones) se
  renderizan los dos y `movil.css` esconde el que no toca. `useEsMovil()` queda
  sólo para lo que no sabe hacer el CSS: geometría del motor, cajón de
  destacados, foco del buscador y descripción de sección en la hoja.
- **Un solo nombre para el botón de cambio de versión.** El sitio estático
  tenía `.m-cambia-vista` (en `movil.css`) y `.vuelve-movil` (con estilos en
  línea escritos desde `dispositivo.js`), porque uno lo ponía la hoja y el otro
  el script. Aquí los dos son el mismo componente de React, así que comparten
  la clase `.cambia-vista`, definida una vez en `movil.css`.
- **`articulo.css` recibe el cromo de la barra y del pie.** La página de
  artículo monta `<Marco satelite>` y `<Pie satelite>` pero su hoja nunca
  definió `.marco`, `.marca`, `.menu-panel`, `.menu-boton` ni ninguna clase del
  pie: la barra se veía como una fila de texto suelto en la esquina y el pie sin
  rejilla. Es un defecto previo de este repositorio, no algo que venga de
  lec-cdmx, pero dejarlo con la cápsula nueva en las otras tres páginas y roto
  en ésta habría sido peor. Se añade el mismo bloque, con las variables que esa
  hoja ya declara.
- **Se pone al día `fondo-flujo`, no sólo su parte de teléfono.** El port de
  este repositorio venía de `3ef890c` del sitio estático, seis commits de
  diseño por detrás: densidad de 4200 partículas, opacidades más altas y un
  bucle que no paraba nunca. La versión de lec-cdmx dibuja durante diez
  segundos —los últimos 1.5s sólo aclarando— y se congela, con 1800 partículas.
  Entra entera, porque media actualización (sólo el recorte de teléfono) habría
  dejado el fondo de escritorio con la densidad vieja y el de teléfono con la
  nueva.
- **`<html suppressHydrationWarning>`.** El guion del `<head>` estampa
  `data-disp` antes de hidratar y React lo señalaba como desajuste en todas las
  páginas. La supresión alcanza sólo a ese elemento, así que un desajuste real
  más adentro sigue avisando.

## Desviaciones respecto al original

- **`hayTextoSinGuardar()` sólo mira campos dentro de un `<form>`.** El
  original recorría todos los `<select>` del documento; la pastilla de idioma
  siempre tiene valor, así que la salvaguarda daba `true` siempre y el cambio
  de versión al cruzar el umbral redimensionando no llegaba a ocurrir nunca.
- **No se porta el contenido de relleno.** `104892f` vacía `ARTICULOS`,
  sustituye el carrusel por tres tarjetas de "Próximamente" y deja el panel de
  artículos con un texto fijo. En el sitio estático eso es la única salida —no
  tiene base de datos—; aquí los artículos vienen de Supabase y copiarlo sería
  una regresión.
- **No se portan las casillas `d5` y `d6`** (aviso de privacidad y cesión de
  derechos de imagen) ni el párrafo `.fecha-limite`. Cambian la validación y el
  contenido del formulario de envío, que es justo la parte técnica que el
  encargo deja fuera. El PDF del aviso de privacidad sí entra, porque el pie de
  página lo enlaza.
- **La barra vuelve a estar fija en las páginas satélite.** El port copió el
  efecto de `fondo-flujo.js` sobre `<Marco>` (`position:relative; z-index:1`),
  que era lo que la despegaba del tope, y lo documentó como comportamiento
  vigente. `af788e1` arregló ese mismo defecto en el origen: el bucle ahora
  salta los elementos ya posicionados. Se quita el estilo en línea de `<Marco>`;
  `<main>` y `<Pie>` lo conservan.

## Pendientes

- **"Ver versión para teléfono" sale en español en los seis idiomas.** Es la
  única cadena nueva que los diccionarios del sitio estático no traducen
  —`dispositivo.js` la tenía escrita a mano en español—, así que el generador
  cae al respaldo. Traducirla es una mejora real, pero según la convención del
  proyecto (`scripts/i18n/generar.mjs`) esa decisión es del comité, no de la
  migración.

## Compromisos

- La cápsula de vidrio se repite en las cuatro hojas (portada, ¿quiénes somos?,
  lineamientos, artículo). Es duplicación real, pero la convención del proyecto
  —documentada en `[locale]/layout.tsx`— es que cada página satélite es
  autónoma y no ve el CSS de las demás; extraer una hoja común obligaría a
  reconciliar los nombres de variable, que no coinciden entre portada
  (`--crema`/`--negro`) y satélites (`--tinta`/`--fondo`).
- `movil.css` se importa desde cada página, después de su propia hoja, para que
  el orden de cascada no dependa de cómo Next ordene el CSS de layout y page.
  Sus selectores ya ganan por especificidad (`html[data-disp="movil"]` añade un
  atributo), pero hay empates posibles (`body.en-portal .riel`) y el orden los
  resuelve sin tener que inflar los selectores.

## Sorpresas

- El `</div>` de cierre de `.pie-legal` se perdió en `104892f` del sitio
  estático. No se replica.
- **`.solo-movil` necesita una regla sin prefijo.** Las dos bajadas del
  recorrido se pintan siempre y el CSS elige cuál se ve. Escondiendo la de
  teléfono sólo dentro de `html[data-disp="movil"]`, en escritorio salían las
  dos, una debajo de otra. La regla que la esconde va sin prefijo y sólo la
  reactivación lleva el atributo.
- **La compuerta visual (`npm run visual`) va a fallar entera, y es lo
  esperado.** `tests/visual/paridad.spec.ts` compara la app contra imágenes
  doradas capturadas de `legado/`, que es el sitio estático viejo. Todo este
  trabajo consiste precisamente en alejarse de ese punto. Hay que decidir qué
  se hace con esa compuerta: o se recapturan las imágenes contra el estado
  nuevo, o se retira. Las imágenes ni siquiera están en el repositorio, así que
  hoy la suite no puede correr.
- **`legado/idiomas/*.js` sí se actualiza.** Son la fuente de la que
  `scripts/i18n/generar.mjs` saca las traducciones, y las seis cadenas nuevas
  de la versión de teléfono viven ahí. Se copian tal cual de lec-cdmx: no
  cambian ni desaparecen entradas existentes, sólo se añaden seis. El resto de
  `legado/` se queda como estaba.
