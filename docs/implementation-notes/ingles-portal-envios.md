# Inglés heredado del portal de envíos

Los 67 textos del portal estaban escritos a mano dentro de dos componentes, en
pares español/inglés. Al pasarlos al sistema de traducción, **sólo el español
sobrevive**: `generar.mjs` empareja por texto español contra los diccionarios
del sitio legado, y estas cadenas no están ahí, así que los seis idiomas las
renderizan en español.

> **Al día siguiente se abrió ese camino y este inglés ya está de vuelta.**
> Vive en `scripts/i18n/traducciones/en.json`, que `generar.mjs` consulta antes
> del legado. Las 61 filas con inglés de las tablas de abajo se cargaron desde
> aquí; las 8 que nunca se escribieron siguen saliendo en español. Cómo traducir
> el resto: `scripts/i18n/traducciones/LEEME.md`.
>
> Esta nota se queda como registro de qué se movió y por qué, y porque sus
> tablas siguen siendo el único sitio donde español e inglés se leen enfrentados.

Ese inglés era trabajo real y no se tira. Aquí queda, emparejado con la clave a
la que fue a parar cada texto. **No se puede pegar en `messages/en.json`**: ese
archivo se genera y la siguiente generación lo pisaría.

Tres claves nacieron sin inglés porque el texto español también es nuevo:
`portal_coautores_max_2`, `portal_rol_no_corresponde` y
`portal_miradas_paper_max_35_paginas`.

## Dos avisos sobre el emparejamiento

- **`resumen_miradas` y `resumen_horizonte` comparten español** («Resumen \*»)
  y por eso son dos claves y no una: el inglés distingue *Abstract* de
  *Summary*. La generación les hereda del legado la misma traducción
  (`Abstract *`); corregir la de Horizonte es exactamente lo que estas dos
  claves separadas hacen posible.
- **Los contadores llevan plural ICU.** Su inglés de abajo ya está en esa forma;
  las lenguas con más de dos formas plurales (el ruso tiene tres) necesitan
  `one`/`few`/`many`/`other`, no una traducción literal de las dos.

## `avisos` — los 20 mensajes de error del portal, más los 3 nuevos

| Clave | Español (lo que se renderiza hoy) | Inglés del colaborador |
|---|---|---|
| `portal_genero_requerido` | Elige una opción de género. | Choose a gender option. |
| `portal_datanomics_texto_200_800` | El texto explicativo debe tener entre 200 y 800 palabras. | The explanatory text must contain 200 to 800 words. |
| `portal_datanomics_visualizacion_1_3` | Adjunta de 1 a 3 imágenes para la visualización. | Attach 1 to 3 images for the visualization. |
| `portal_repositorio_url` | Escribe un enlace válido para el repositorio. | Enter a valid repository link. |
| `portal_semblanza_requerida` | Completa la semblanza. | Complete the profile. |
| `portal_modalidad_requerida` | Elige la modalidad de entrevista. | Choose the interview format. |
| `portal_foto_requerida` | Adjunta la foto solicitada. | Attach the requested photo. |
| `portal_cesion_requerida` | Adjunta la cesión de derechos de imagen firmada en PDF. | Attach the signed image rights release as a PDF. |
| `portal_miradas_resumen_100_300` | El resumen debe tener entre 100 y 300 palabras. | The abstract must contain 100 to 300 words. |
| `portal_miradas_paper_requerido` | Adjunta el paper en PDF. | Attach the paper as a PDF. |
| `portal_miradas_anexos_max_3` | Puedes adjuntar como máximo 3 anexos. | You can attach up to 3 appendices. |
| `portal_horizonte_resumen_max_200` | El resumen debe tener entre 1 y 200 palabras. | The summary must contain 1 to 200 words. |
| `portal_horizonte_articulo_requerido` | Adjunta el artículo en PDF. | Attach the article as a PDF. |
| `portal_sabias_dato_max_200` | El dato debe tener entre 1 y 200 palabras. | The fact must contain 1 to 200 words. |
| `portal_sabias_imagen_max_1` | Puedes adjuntar como máximo una imagen. | You can attach at most one image. |
| `portal_capital_cronica_500_900` | La crónica debe tener entre 500 y 900 palabras. | The chronicle must contain 500 to 900 words. |
| `portal_capital_fotos_1_4` | Adjunta de 1 a 4 fotos. | Attach 1 to 4 photos. |
| `portal_capital_pies_requeridos` | Escribe los pies de imagen en orden, separados por coma. | Enter the image captions in order, separated by commas. |
| `portal_excelencia_cronica_requerida` | Completa la crónica. | Complete the chronicle. |
| `portal_archivo_tipo` | El tipo de archivo no corresponde con este campo. | The file type does not match this field. |
| `portal_coautores_max_2` | Puedes indicar como máximo dos coautores, separados por coma. | — *(nunca se escribió)* |
| `portal_miradas_paper_max_35_paginas` | El paper no puede pasar de 35 cuartillas. | — *(nunca se escribió)* |
| `portal_rol_no_corresponde` | Ese archivo no corresponde con la sección elegida. | — *(nunca se escribió)* |

## `formularioenvio`

| Clave | Español (lo que se renderiza hoy) | Inglés del colaborador |
|---|---|---|
| `paso_pieza` | Información de la pieza | Piece information |
| `campo_seccion` | Sección * | Section * |
| `campo_genero` | Género * | Gender * |
| `sobre_la_pieza` | Sobre la pieza | About the piece |
| `campo_titulo` | Título * | Title * |
| `archivos_y_contenido_de_la_pieza` | Archivos y contenido de la pieza | Files and piece content |
| `enviar` | Enviar | Submit |
| `continuar` | Continuar | Continue |

## `camposarchivosenvio`

Las cuatro filas sin inglés son literales que el colaborador nunca tradujo: se
renderizaban en español en los seis idiomas incluso antes de esta entrega.

| Clave | Español (lo que se renderiza hoy) | Inglés del colaborador |
|---|---|---|
| `seleccionar_archivo` | Seleccionar archivo | — *(nunca se escribió)* |
| `n_archivos` | {n, plural, one {# archivo} other {# archivos}} | — *(nunca se escribió)* |
| `quitar_a` | Quitar {a} | — *(nunca se escribió)* |
| `contador_min_max` | {n, plural, one {# palabra} other {# palabras}} · mínimo {min} · máximo {max} | {n, plural, one {# word} other {# words}} · minimum {min} · maximum {max} |
| `contador_max` | {n, plural, one {# palabra} other {# palabras}} · máximo {max} | {n, plural, one {# word} other {# words}} · maximum {max} |
| `repositorio_opcional` | Repositorio (opcional) | Repository (optional) |
| `texto_explicativo` | Texto explicativo * | Explanatory text * |
| `visualizacion` | Visualización * | Visualization * |
| `hasta_3_imagenes_jpg_png_o_webp` | Hasta 3 imágenes (JPG, PNG o WebP) | Up to 3 images (JPG, PNG or WebP) |
| `semblanza` | Semblanza * | Profile * |
| `cargo_anos_de_experiencia_trayectoria` | Cargo, años de experiencia, trayectoria | Role, years of experience, career path |
| `modalidad_de_entrevista` | Modalidad de entrevista * | Interview format * |
| `elige_una_modalidad` | Elige una modalidad | Choose a format |
| `presencial` | Presencial | — *(nunca se escribió)* |
| `en_linea` | En línea | — *(nunca se escribió)* |
| `foto_suya` | Foto suya * | Portrait photo * |
| `1_imagen_jpg_png_o_webp` | 1 imagen (JPG, PNG o WebP) | 1 image (JPG, PNG or WebP) |
| `cesion_de_derechos_de_imagen_llenada_y_firmada` | Cesión de derechos de imagen llenada y firmada * | Signed image rights release * |
| `cesion_de_derechos_de_imagen` | Cesión de derechos de imagen | Image rights release |
| `resumen_miradas` | Resumen * | Abstract * |
| `paper` | Paper * | Paper * |
| `pdf_maximo_35_cuartillas` | PDF · máximo 35 cuartillas | PDF · maximum 35 pages |
| `anexos_opcional` | Anexos (opcional) | Appendices (optional) |
| `hasta_3_archivos_pdf` | Hasta 3 archivos PDF | Up to 3 PDF files |
| `resumen_horizonte` | Resumen * | Summary * |
| `articulo` | Artículo * | Article * |
| `pdf_800_a_1500_palabras_incluir_graficas_en_el_p_f838` | PDF · 800 a 1500 palabras · incluir gráficas en el PDF | PDF · 800 to 1,500 words · include charts in the PDF |
| `dato` | Dato * | Fact * |
| `imagen_opcional` | Imagen (opcional) | Image (optional) |
| `maximo_1_imagen_jpg_png_o_webp` | Máximo 1 imagen (JPG, PNG o WebP) | Maximum 1 image (JPG, PNG or WebP) |
| `cronica` | Crónica * | Chronicle * |
| `foto` | Foto * | Photos * |
| `de_1_a_4_imagenes_jpg_png_o_webp` | De 1 a 4 imágenes (JPG, PNG o WebP) | 1 to 4 images (JPG, PNG or WebP) |
| `pies_de_imagen` | Pies de imagen * | Image captions * |
| `en_orden_separados_por_coma` | En orden, separados por coma | In order, separated by commas |
| `semestre_logro_historia_breve_etc` | Semestre, logro, historia breve, etc. | Semester, achievement, brief story, etc. |
| `como_consiguio_la_oportunidad_cuales_fueron_los_d695` | ¿Cómo consiguió la oportunidad? ¿Cuáles fueron los mayores desafíos? ¿Qué aprendizajes le dejó? | How did you get the opportunity? What were the biggest challenges? What did you learn? |
| `selecciona_una_seccion_en_el_paso_de_autoria` | Selecciona una sección en el paso de Autoría. | Choose a section in the Authorship step. |
