# Vértices

Revista académica de economía de la Facultad de Economía, hecha por
estudiantes. Este repositorio es su sitio público y su sistema editorial:
recibe manuscritos, los enruta a dictamen a doble ciego con los instrumentos
del comité, y publica los números.

Sustituye a un sitio estático más un libro de Excel. El defecto que motivó la
reescritura fue la **pérdida silenciosa de envíos**: el formulario inventaba un
folio y enseñaba éxito cuando el registro fallaba.

<!--
  Glosario del proyecto. Un término canónico por concepto; los sinónimos que
  circulan van en _Evitar_. Se actualiza cuando una discusión resuelve una
  ambigüedad, no de golpe.

  El vocabulario es español porque el comité trabaja en español y la base de
  datos guarda español: secciones, temas y decisiones son datos, no copia de
  interfaz. El código sigue esa misma lengua.
-->

## El flujo editorial

**Envío**:
Un manuscrito recibido, con su metadata y sus archivos. Es la unidad del
sistema: todo cuelga de él. Existe desde que el formulario público lo registra
y no se borra nunca en duro una vez tiene decisión.
_Evitar_: submission, artículo (un artículo es otra cosa), paper.

**Folio**:
El identificador que el autor ve y teclea, `VTX-2026-001`. Sale de un contador
por año, no de una secuencia, y el año se calcula en `America/Mexico_City`. Es
inmutable.
_Evitar_: id (el id es un uuid interno), número de envío.

**Triaje**:
Darle sección de verdad a una pieza que llegó sin ella. Sin sección no hay
nivel, y sin nivel no hay instrumento con el que dictaminar, así que una pieza
sin triar no se puede asignar a nadie.
_Evitar_: clasificación, categorización.

**Nivel**:
A, B o C. Sale de la sección y determina qué tan exigente es la rúbrica. No se
elige a mano: lo deriva un disparador de la base a partir de la sección y el
tipo de pieza.

**Instrumento**:
La rúbrica concreta con la que se dictamina una pieza — hay ocho, una por
sección dictaminable. `envios.seccion_dictamen_id` dice cuál, y no siempre
coincide con la sección de la pieza: Horizonte Global con investigación se
dictamina con el de Miradas Económicas.
_Evitar_: rúbrica a secas cuando se habla de cuál aplica; formulario.

**Dictamen**:
La evaluación de una persona sobre un envío. Es una tarjeta con puertas y
dimensiones. Vive en `borrador` hasta que se envía, y enviarla es irreversible.
_Evitar_: revisión, review, evaluación.

**Puerta**:
Una pregunta de sí/no del instrumento. Las marcadas con ★ son **eliminatorias**:
si no son «Sí» —y dejarlas en blanco cuenta como no— la pieza no pasa.
_Evitar_: criterio, requisito.

**Dimensión**:
Un criterio puntuado de 0 a 3. Las marcadas con ★ son **críticas**: por debajo
de 2 reprueban la pieza entera. Algunas pesan doble.
_Evitar_: rubro, ítem.

**Decisión**:
El veredicto. Hay dos que no son lo mismo y conviene no confundirlas:
- **sugerida** — la que calcula el motor a partir de la tarjeta, y queda en la
  instantánea del dictamen;
- **grabada** — la que una persona del comité registra en el envío. Es la que ve
  el autor y la única que abre la puerta a publicar.
_Evitar_: resultado, calificación.

**Instantánea**:
Puntaje, máximo, puertas ★, críticos ★ y decisión sugerida, escritos en el
momento de enviar el dictamen y nunca recalculados. Es lo que el comité vio el
día que dictaminó, aunque la rúbrica cambie después.
_Evitar_: snapshot, cálculo.

## La ceguera

**Doble ciego** (o **la ceguera**):
La regla de §7: nadie del comité ve la autoría de un envío hasta que **ella
misma** haya enviado dictamen de esa pieza, o hasta que el envío tenga decisión
grabada. No es un nivel de permiso, es una función de (quién mira, qué envío).
_Evitar_: anonimato, privacidad.

**Desvelar**:
Que la autoría deje de estar oculta. Hay tres disparadores y todos son actos
deliberados que quedan en la bitácora: enviar el propio dictamen (desvela sólo
para esa persona), grabar la decisión (para todo el comité) y publicar.
_Evitar_: revelar, destapar, unblind.

**Anonimización**:
El paso humano de comprobar que el manuscrito no lleva el nombre del autor
impreso en la portada, el encabezado o los agradecimientos. Distinto de quitar
los metadatos, que sí es automático. La revista promete lo segundo y pide lo
primero.
_Evitar_: usar «anonimización» para hablar del borrado de metadatos, o del
reprocesado de las imágenes.

**Limpieza de metadatos**:
Quitar del archivo los datos ocultos que delatan al autor: EXIF, XMP, el nombre
del equipo, la ubicación GPS de la foto. Es automática y no depende de nadie:
`limpiar()` la aplica a todo archivo que entra. Es lo que la revista **promete**;
la anonimización es lo que **pide**.
_Evitar_: anonimización, limpiar el archivo a secas (se limpia el manuscrito
también, y eso es otra cosa).

**Optimización de imagen**:
Bajar el peso y las dimensiones de una foto al recibirla —tope de 3600 px en el
lado largo— para que quepa en el almacén. Ocurre en la misma pasada que la
limpieza de metadatos y por eso se confunden, pero persiguen cosas distintas:
una protege al autor, la otra protege el almacén. Si el reprocesado falla se
guarda el original —con sus metadatos dentro—, marcado y anotado en la
bitácora: el envío nunca se rechaza por una foto. El porqué del tope y del
formato de salida está en `docs/adr/0001-fotos-optimizadas-al-recibirlas.md`.
_Evitar_: comprimir, redimensionar, limpiar la imagen.

**Bitácora**:
`envio_eventos`. Sólo se añade: nadie tiene UPDATE ni DELETE, ni el comité. Es
lo que sostiene que la ceguera sea *responsable* aunque no sea absoluta.
_Evitar_: log, historial, auditoría.

## La publicación

**Artículo**:
Una pieza ya publicable, con su URL. Nace de un envío con decisión aceptante, o
es uno de los 26 de muestra. **No es lo mismo que un envío**: un envío puede no
llegar nunca a artículo, y un artículo puede sobrevivir al borrado de su envío.
_Evitar_: pieza publicada, post.

**Número** (o **edición**):
Un conjunto de artículos que se publica de golpe. Nace en borrador; publicarlo
copia los PDF al bucket público y enciende todas sus piezas a la vez.
_Evitar_: issue, volumen.

**Pieza de muestra** (**placeholder**):
Uno de los 26 artículos de demostración que se siembran con
`es_placeholder = true`. Existen para que el descubrimiento por tema y por
sección funcione antes del primer número. No tienen PDF y no se indexan.
_Evitar_: artículo falso, dummy, ejemplo.

**Bucket privado / bucket público**:
`manuscritos` y `publicaciones`. El primero no tiene ni una política y sólo lo
alcanza el `service_role`; el segundo es público a propósito y sólo recibe
copias de PDF ya publicados. Lo que se publica es una **copia**, nunca el
original.

## Cosas del sitio

**Portada**:
La página de inicio con el lienzo de partículas, el carrusel y el formulario.
_Evitar_: home, landing.

**Página satélite**:
`lineamientos`, `quienes-somos`, `equipo`. Cada una es autónoma y trae su propia
hoja de estilos: cargar la de la portada provoca colisiones de clase que en el
sitio original no existen.
_Evitar_: página interna, subpágina.

**Panel**:
El sistema editorial en `/panel`. Interno, en español, fuera del enrutado por
idioma.
_Evitar_: admin, backoffice, dashboard.

**Invitación**:
El enlace de un solo uso con el que alguien entra al comité. No hay alta
pública. Tiene tres estados que son tres preguntas distintas y no una sola:
**pendiente** (salió el correo, nadie ha fijado contraseña), **activa**
(`clave_fijada_en` tiene fecha) y **rebotada** (Resend dijo que la dirección no
existe). **De baja** no es un cuarto estado de la invitación sino de la persona,
y gana sobre los tres.
_Evitar_: registro, sign-up, alta.

**Página puente**:
`/panel/invitacion`. Lo que el correo de invitación abre. No canjea el token al
cargarse: hace falta pulsar un botón. Existe porque los escáneres de enlaces del
correo institucional gastan un token de un solo uso con su GET.
_Evitar_: landing de invitación, callback.

**Compuerta visual**:
La suite de Playwright que compara la portada y las satélites, en los seis
idiomas, contra imágenes doradas capturadas del **sitio legado**. Es la que hace
exigible «preservar el diseño exactamente». Las imágenes no se regeneran contra
la app: eso convertiría la compuerta en una tautología.
_Evitar_: pruebas visuales, snapshots.

**Sitio legado**:
El sitio estático que esto sustituye, todavía en Netlify con un Worker delante.
Es la referencia de la compuerta visual hasta el cutover.
_Evitar_: sitio viejo, v1.

## Ambigüedades resueltas

**«Rúbrica» servía para tres cosas**: el instrumento de una sección, la fila de
`rubrica_versiones`, y la tarjeta que llena quien dictamina. Ahora: **instrumento**
para el primero, **versión de rúbrica** para el segundo, **dictamen** o **tarjeta**
para el tercero.

**«Decisión» se usaba para la sugerida y la grabada indistintamente**, que es
justo el defecto del libro: `Registro!S4` enseña al autor la decisión *vigente*,
que cae en la auto-sugerida, de modo que hoy basta que alguien puntúe una
dimensión para que el estado público salte a jerga cruda. Siempre hay que decir
cuál de las dos.

**«Artículo» y «envío» no son sinónimos.** Ver arriba. La confusión importa
porque `articulos.envio_id` es `ON DELETE SET NULL` a propósito: quitar un envío
no puede dejar en 404 una URL publicada.

**«Sección» de un envío no siempre es la sección de su instrumento.**
`seccion_id` es dónde va la pieza; `seccion_dictamen_id` es con qué se juzga.
Coinciden salvo en la excepción de Horizonte Global.
