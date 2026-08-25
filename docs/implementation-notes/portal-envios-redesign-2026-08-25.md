# Implementation notes — rediseño del portal de envíos

- **Spec**: `Rediseño de Portal de Envíos.pdf` (adjunto de diseño)
- **Plan**: n/a
- **Started**: 2026-08-25
- **Implemented**: 2026-08-25

## Decisions made outside the spec
- La sección sigue guardándose con los nombres canónicos existentes de la base (`¿Sabías Qué?` incluido), aunque la copia visible del diseño use `¿Sabías qué?`, para no romper el enrutamiento editorial.
- El tipo de pieza deja de ser una elección del autor y se deriva de la sección: Datanomics→Visualización, La Voz de la Experiencia→Entrevista, Miradas Económicas→Paper/Investigación, Horizonte Global→Artículo, ¿Sabías Qué?→Cápsula, Capital Social→Crónica, Excelencia en Acción→Crónica.
- Los datos específicos de cada sección se guardan completos en `envios.datos_seccion` (JSONB) y cada archivo lleva un rol explícito en `envio_archivos.rol`.
- `¿Sabías Qué?` puede registrar un envío sin archivo porque su imagen es opcional; las demás secciones validan sus adjuntos obligatorios.

## Resend
- La plantilla publicada se configura con `RESEND_CONFIRMACION_TEMPLATE_ID`.
- Se mandan exactamente las variables pedidas: `lang` (`es` en español y `eng` en cualquier otro idioma), `genero`, `seccion`, `nom_pieza` y `folio`.
- Después de confirmar el registro en Supabase se intenta añadir el correo a Contactos de Resend. Un fallo de contacto o de correo no invalida un envío ya guardado y queda anotado en `envio_eventos`.

## Tradeoffs
- El requisito de 800–1500 palabras del artículo de Horizonte Global se muestra como regla editorial, pero no se cuenta automáticamente desde el PDF. `pdf-lib` permite inspeccionar páginas y metadatos, pero no extraer texto de manera fiable.
- El límite de 35 páginas de Miradas Económicas sí se valida en servidor.
- Las imágenes se admiten por firma de contenido (JPEG, PNG y WebP). Se conservan en el bucket privado y quedan marcadas en bitácora como no limpiadas automáticamente, porque la canalización actual no reencodifica imágenes para quitar EXIF/XMP.

## Verification
- Se actualizaron las pruebas unitarias de validación, transporte de archivos y reconocimiento de formatos para el nuevo contrato.
- No hay workflow de GitHub Actions en el repositorio y este entorno no puede clonar GitHub para ejecutar `npm test`/`npm run typecheck` localmente; las comprobaciones de ejecución quedan pendientes en un entorno con dependencias instaladas.
