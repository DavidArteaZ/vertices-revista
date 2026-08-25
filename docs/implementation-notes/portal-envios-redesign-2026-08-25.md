# Implementation notes — rediseño del portal de envíos

- **Spec**: `Rediseño de Portal de Envíos.pdf` (adjunto de diseño)
- **Plan**: n/a
- **Started**: 2026-08-25

## Decisions made outside the spec
- La sección seguirá guardándose con los nombres canónicos existentes de la base (`¿Sabías Qué?` incluido), aunque la copia visible del diseño use `¿Sabías qué?`, para no romper el enrutamiento editorial.
- El tipo de pieza deja de ser una elección del autor y se deriva de la sección: Datanomics→Visualización, La Voz de la Experiencia→Entrevista, Miradas Económicas→Paper/Investigación, Horizonte Global→Artículo, ¿Sabías Qué?→Cápsula, Capital Social→Crónica, Excelencia en Acción→Crónica.
- Los datos específicos de cada sección se guardarán completos en JSONB en el envío y cada archivo llevará un rol explícito; así el formulario no captura información que luego se pierda.

## Tradeoffs
- El requisito de 800–1500 palabras del artículo de Horizonte Global se mostrará como regla editorial, pero no se contará automáticamente desde el PDF. La dependencia actual (`pdf-lib`) permite inspeccionar páginas y metadatos, pero no extraer texto de manera fiable. El límite de 35 páginas de Miradas Económicas sí se validará en servidor.
- Las imágenes se admitirán por firma de contenido (JPEG, PNG y WebP). Se conservarán en el bucket privado y quedarán marcadas en bitácora como no limpiadas automáticamente, porque la canalización actual sólo elimina metadatos de PDF/DOCX.
