# 0001 — Las fotos se reprocesan al recibirlas, y el original no se guarda

**Estado**: aceptada. Entrega 1 del portal de envíos.

Las secciones que reciben imágenes (Datanomics, Capital Social) admiten fotos de
celular y gráficas exportadas: archivos de entre 4 y 20 MB que llegan con sus
metadatos ocultos pegados —EXIF, XMP, y con ellos la ubicación GPS y el nombre
del equipo—. Se decide **reprocesar cada imagen en el momento de recibirla**,
con un tope de **3600 px en el lado largo**, guardar únicamente el resultado y
**no conservar el original**.

## Por qué 3600 px

Una página A4 completa a 300 puntos por pulgada son 3508 px en el lado largo.
3600 deja margen para el recorte a sangre. Por encima de esa cifra no hay
ganancia que la imprenta pueda usar: sólo peso.

## Por qué no se conserva el original

El almacén del plan gratuito son 1 GB. Guardar original y copia habría llenado
tres cuartas partes de ese GB con el primer número, y **un almacén lleno hace
que las subidas empiecen a fallar** — que es exactamente el modo de fallo que
todo este trabajo existe para evitar, sólo que peor: aparecería de golpe, en
mitad de una convocatoria, y sin relación aparente con la causa.

La reducción esperada es del **70–85%**, pero eso no se supone: cada envío con
imágenes deja un evento `imagen_optimizada` en la bitácora con los bytes antes y
después, las dimensiones y el porcentaje real. La cifra se comprueba en
producción.

**Consecuencia que hay que decir con todas las letras:** si dentro de seis meses
producción decide que 3600 px no bastan para algo, las fotos ya recibidas no se
recuperan. La única salida sería volver a pedírselas a sus autores. Ésta es la
parte irreversible de la decisión, y se acepta a sabiendas.

## El formato de salida es el mismo que el de entrada

JPEG sale JPEG, PNG sale PNG, WebP sale WebP. No se transcodifica a un formato
«mejor», por dos razones independientes y ambas suficientes:

- `crear_envio` deriva la extensión del nombre público a partir del nombre
  original. Transcodificar a WebP dejaría un archivo llamado `.png` con bytes
  WebP dentro: un objeto que abre bien en unos programas y no en otros, y cuya
  causa nadie encontraría meses después.
- Una gráfica de Datanomics pasada a JPEG se degrada visiblemente en el texto
  fino. El formato que eligió quien exportó la gráfica suele ser el correcto.

## Alternativas consideradas

- **Comprimir en el navegador antes de subir.** Descartada: no garantiza que los
  metadatos se borren. Depende del navegador del autor, y un solo caso que
  falle publica una coordenada GPS.
- **Las transformaciones de imagen de Supabase.** Descartadas: son de plan de
  pago.
- **Conservar el original junto a la copia.** Descartada por el almacén, arriba.

## La fragilidad de `sharp`, escrita para que no sorprenda

`sharp` lleva código nativo compilado. Es el tipo de dependencia que falla **al
construir**, no al ejecutarse, y típicamente tras un cambio de versión de Node o
de plataforma de despliegue. El síntoma es un despliegue que no termina con un
error de compilación nativa, y quien mantiene esta revista no es programador y
no podría diagnosticarlo por su cuenta.

Sigue siendo la elección correcta —las dos alternativas están descartadas
arriba—, pero de ahí salen dos cautelas que conviene no «limpiar»:

1. **La versión va fija** en `package.json` (`0.35.3`, sin `^`). Descomprimir
   imágenes de desconocidos es superficie de ataque conocida: los fallos de las
   bibliotecas de imagen se explotan con archivos preparados, y una
   actualización automática puede meter o quitar el parche sin que nadie mire.
2. **Existe un límite de 40 millones de píxeles.** Una imagen así ocupa cientos
   de megas al descomprimirse, y en Vercel varias peticiones simultáneas
   comparten instancia.

Ninguno de los caminos de error del optimizador rechaza el envío: se guarda el
original, se marca como no limpiado y se anota en la bitácora. Un envío que el
autor cree enviado no se pierde nunca, ni siquiera por una foto rota.
