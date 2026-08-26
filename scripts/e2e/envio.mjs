/**
 * Prueba manual de extremo a extremo de la tubería de envío, contra el
 * servidor local y el proyecto REAL de Supabase.
 *
 *     npm run build && npm run start   # en otra terminal
 *     node scripts/e2e/envio.mjs
 *
 * No está en `npm test` y no debe estarlo: escribe en la base de producción y
 * necesita la clave de servicio. Se corre a mano antes de tocar la tubería.
 *
 * Existe porque las pruebas unitarias no podían encontrar lo que encontró
 * esto: `limpiar` quitaba los metadatos correctamente y el objeto del bucket
 * quedaba limpio, pero descargar la ruta devolvía el ORIGINAL con el nombre
 * del autor dentro. El archivo se subía sucio, se sobrescribía limpio unos
 * segundos después, y el CDN seguía sirviendo lo primero. Sólo se ve cruzando
 * el sistema entero.
 *
 * Por lo mismo manda DOS envíos: uno con PDF y otro con FOTOGRAFÍA. El de la
 * foto está aquí porque el hueco que dejaba el portal inservible tampoco se
 * veía desde una prueba unitaria: el código aceptaba imágenes y el bucket sólo
 * admitía PDF y Word, así que la subida —que va del navegador directo a
 * Storage— rebotaba sin dejar rastro en los registros de la app. Esa mitad la
 * cubre ahora `supabase/tests/superficie-api.sql`; aquí se comprueba la otra,
 * la que ninguna afirmación sobre la base puede ver: que la foto llega, se
 * guarda sin EXIF y pesa menos que la que mandó el autor.
 *
 * Al terminar borra lo que creó.
 */
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { PDFDocument } from "pdf-lib";
import sharp from "sharp";
import { createClient } from "@supabase/supabase-js";

const BASE = process.env.BASE ?? "http://localhost:3100";
const AUTOR = "Autora Que No Debe Aparecer";
const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");

const env = Object.fromEntries(
  readFileSync(path.join(RAIZ, ".env.local"), "utf8")
    .split("\n")
    .filter((l) => l.includes("=") && !l.trimStart().startsWith("#"))
    .map((l) => [l.slice(0, l.indexOf("=")), l.slice(l.indexOf("=") + 1)]),
);
const sb = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);

let fallos = 0;
const comprueba = (etiqueta, real, esperado) => {
  const ok = JSON.stringify(real) === JSON.stringify(esperado);
  if (!ok) fallos++;
  console.log(`${ok ? "ok  " : "FALLA"} ${etiqueta}${ok ? "" : `  — esperaba ${JSON.stringify(esperado)}, dio ${JSON.stringify(real)}`}`);
};

/** El nombre puede seguir dentro en claro, en UTF-16 o en hexadecimal. */
function contieneAutor(buf) {
  const s = Buffer.from(buf).toString("latin1");
  const hex = [...AUTOR].map((c) => c.charCodeAt(0).toString(16).padStart(4, "0")).join("").toUpperCase();
  return s.includes(AUTOR) || s.toUpperCase().includes(hex);
}

/** Texto de n palabras: los topes por sección se cuentan en palabras. */
const palabras = (n) => Array.from({ length: n }, (_, i) => `palabra${i}`).join(" ");

const pide = async (ruta, cuerpo) => {
  const r = await fetch(`${BASE}${ruta}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(cuerpo),
  });
  return [r.status, await r.json()];
};

// ------------------------------------------------------------------ arranque
//
// El límite de tasa es real: diez envíos por hora y por IP. Esta prueba gasta
// seis cada vez que se corre —dos envíos buenos y cuatro rechazos, que también
// cuentan porque el límite se cobra antes de validar—, y desde localhost todas
// las corridas comparten huella: la segunda corrida seguida se queda sin cupo.
// No se puede reiniciar desde aquí —privado no está expuesto por
// PostgREST y no debe estarlo—, así que lo que se hace es detectarlo y
// decirlo, en vez de informar de un 429 como si fuera un fallo del código:
//
//     delete from privado.golpes;   -- en el SQL editor, para volver a correr

const pdf = await PDFDocument.create();
pdf.addPage();
pdf.setAuthor(AUTOR);
pdf.setCreator(AUTOR);
pdf.setTitle("Título privado del manuscrito");
const bytes = await pdf.save({ useObjectStreams: false });
comprueba("el PDF de prueba lleva el nombre del autor dentro", contieneAutor(bytes), true);

// --------------------------------------------------------------------- firma
const [sFirma, firmas] = await pide("/api/uploads", {
  archivos: [{ nombre: "Mi Manuscrito.PDF", bytes: bytes.length }],
});
comprueba("POST /api/uploads devuelve una URL firmada", sFirma, 200);
const firmada = firmas.subidas[0];

const fd = new FormData();
fd.append("cacheControl", "0");
fd.append("", new Blob([bytes], { type: "application/pdf" }), "manuscrito.pdf");
const subida = await fetch(firmada.url, { method: "PUT", body: fd });
comprueba("el navegador sube directo a Storage", subida.status, 200);

// ------------------------------------------------------------------ registro
const datos = {
  nombre: AUTOR,
  correo: "no-existe-esta-direccion@example.invalid",
  perfil: "Estudiante de otra licenciatura",
  afiliacion: "Universidad de Prueba",
  coautores: "",
  // Ya no vale el vacío: el género se contrasta contra su catálogo porque
  // viaja como variable de plantilla hasta Resend.
  genero: "Prefiero no responder aquí",
  titulo: "Un manuscrito de prueba de extremo a extremo",
  // El formulario ya no pregunta el tipo de pieza: se deriva de la sección. Eso
  // deja fuera del portal la excepción del libro —Paper + Horizonte Global sube
  // a Nivel A y se dictamina con el instrumento de Miradas—, que hoy sólo puede
  // producirla el triaje del panel. Por eso aquí se afirma lo que la sección da
  // por sí sola, que es lo que de verdad recorre esta tubería.
  seccion: "Horizonte Global",
  tema: "Macroeconomía",
  // El texto de la pieza ya no es un campo suelto: vive en `campos`, cuya forma
  // depende de la sección, y acaba entero en `envios.datos_seccion`.
  campos: { resumen: palabras(130) },
  claves: "inflación, tipo de cambio, tasas",
  usoIA: "No",
  d1: true, d2: true, d3: true, d4: true, d5: true, d6: true,
};

// Cada archivo declara su rol, y la sección decide qué roles admite. Sin él la
// ruta descarta el adjunto entero antes de validar nada.
const archivos = [{ path: firmada.path, nombre: "Mi Manuscrito.PDF", bytes: bytes.length, rol: "articulo" }];
const [sEnvio, creado] = await pide("/api/envios", { datos, locale: "es", archivos });

if (sEnvio === 429) {
  console.log(
    "\nlímite de tasa agotado para esta IP (10 envíos por hora, y es a propósito).\n" +
      "Para volver a correr la prueba:  delete from privado.golpes;",
  );
  process.exit(2);
}

comprueba("POST /api/envios responde 200", sEnvio, 200);
comprueba("y devuelve un folio con el formato que el sitio pide teclear", /^VTX-\d{4}-\d{3}$/.test(creado.folio ?? ""), true);

// --------------------------------------------------- lo que quedó almacenado
const { data: fila } = await sb
  .from("envios")
  .select("id, nivel, es_investigacion, declaraciones, datos_seccion, seccion_dictamen_id, secciones!envios_seccion_dictamen_id_fkey(slug)")
  .eq("folio", creado.folio)
  .single();

comprueba("Horizonte Global enruta a su propio nivel", fila.nivel, "B");
comprueba("y a su propio instrumento", fila.secciones?.slug, "horizonte-global");
comprueba("el tipo sale de la sección, así que un artículo no es investigación", fila.es_investigacion, false);
comprueba("las declaraciones obligatorias quedan guardadas", [fila.declaraciones.d1, fila.declaraciones.d3, fila.declaraciones.d4, fila.declaraciones.d5, fila.declaraciones.d6], [true, true, true, true, true]);
comprueba("con la versión del texto aceptado", typeof fila.declaraciones.version, "string");
// Es el texto que el comité lee en el panel. Si no llegara íntegro, la ficha
// del envío enseñaría la nota de «envío anterior al formulario por secciones»
// y nadie sabría que se perdió por el camino.
comprueba("el texto de la pieza queda entero en datos_seccion", fila.datos_seccion?.resumen, palabras(130));

const { data: adjuntos } = await sb
  .from("envio_archivos")
  .select("storage_path, nombre_publico, mime, rol")
  .eq("envio_id", fila.id);

comprueba("el nombre público no viene del nombre original", adjuntos[0].nombre_publico, `${creado.folio}-01.pdf`);
comprueba("y el rol viaja hasta la base, que es de donde lo lee el panel", adjuntos[0].rol, "articulo");

const { data: blob } = await sb.storage.from("manuscritos").download(adjuntos[0].storage_path);
const guardado = Buffer.from(await blob.arrayBuffer());
comprueba("el archivo almacenado NO lleva el nombre del autor", contieneAutor(guardado), false);
// Se pregunta al LISTADO y no a download(): descargar pasa por el CDN, que
// puede seguir sirviendo una copia de un objeto ya borrado. Es la misma
// trampa que escondió el fallo de los metadatos, sólo que aquí engañaría en
// la dirección contraria. El listado sí lee storage.objects.
const { data: enBucket } = await sb.storage.from("manuscritos").list("", { limit: 1000 });
comprueba(
  "la ruta sucia original ya no existe en el bucket",
  (enBucket ?? []).some((o) => o.name === firmada.path),
  false,
);

// -------------------------------------------------------------------- estado
comprueba("estado con el correo correcto, en otras mayúsculas", (await pide("/api/estado", { folio: creado.folio, correo: "  NO-EXISTE-esta-direccion@example.invalid " }))[1].estado, "ok");
comprueba("estado con el correo equivocado", (await pide("/api/estado", { folio: creado.folio, correo: "otra@example.invalid" }))[1].estado, "no_coincide");
comprueba("estado con un folio inexistente: respuesta idéntica", (await pide("/api/estado", { folio: "VTX-2026-999", correo: "otra@example.invalid" }))[1].estado, "no_coincide");

// ------------------------------------------------------- envío con fotografía
//
// Cinco de las siete secciones piden fotografías o visualizaciones, y hasta
// esta entrega ninguna llegaba: el código las aceptaba y el bucket sólo
// admitía PDF y Word, así que la subida rebotaba entre el navegador y Storage,
// donde nuestros registros no miran. `supabase/tests/superficie-api.sql` cubre
// ahora la mitad de la base; esto cubre la otra, que es la única que ve si la
// foto llega entera y sale limpia.
//
// El JPEG se fabrica aquí y no se versiona: una foto de verdad traería dentro
// a una persona real. Lleva el nombre de la autora escrito en el EXIF, que es
// exactamente el metadato que el optimizador tiene que borrar.

const ANCHO = 4800;
const ALTO = 3200;
const pixeles = Buffer.allocUnsafe(ANCHO * ALTO * 3);
for (let y = 0, i = 0; y < ALTO; y++) {
  for (let x = 0; x < ANCHO; x++) {
    pixeles[i++] = ((x * 255) / ANCHO) | 0;
    pixeles[i++] = ((y * 255) / ALTO) | 0;
    // Un tablero fino: dos degradados solos comprimen a casi nada y comparar
    // pesos con un archivo de veinte kilobytes no demostraría gran cosa.
    pixeles[i++] = ((x >> 4) ^ (y >> 4)) & 0xff;
  }
}

const foto = await sharp(pixeles, { raw: { width: ANCHO, height: ALTO, channels: 3 } })
  .withExif({ IFD0: { Copyright: AUTOR, Artist: AUTOR } })
  .jpeg({ quality: 92 })
  .toBuffer();
comprueba("la foto de prueba lleva el nombre de la autora en el EXIF", contieneAutor(foto), true);

const [sFirmaFoto, firmasFoto] = await pide("/api/uploads", {
  archivos: [{ nombre: "Foto Del Evento.JPG", bytes: foto.length }],
});
comprueba("POST /api/uploads firma también imágenes", sFirmaFoto, 200);
const firmadaFoto = firmasFoto.subidas[0];

const fdFoto = new FormData();
fdFoto.append("cacheControl", "0");
// El tipo se fuerza por extensión igual que hace el navegador: Safari a veces
// manda el tipo vacío y el bucket lo rechazaría por `allowed_mime_types`.
fdFoto.append("", new Blob([foto], { type: "image/jpeg" }), "foto.jpg");
const subidaFoto = await fetch(firmadaFoto.url, { method: "PUT", body: fdFoto });
comprueba("el bucket acepta un JPEG (antes lo rebotaba sin decir nada)", subidaFoto.status, 200);

const datosFoto = {
  ...datos,
  titulo: "Una cápsula de prueba de extremo a extremo",
  seccion: "¿Sabías Qué?",
  campos: { dato: palabras(40) },
};
const archivosFoto = [
  { path: firmadaFoto.path, nombre: "Foto Del Evento.JPG", bytes: foto.length, rol: "foto" },
];
const [sFoto, creadoFoto] = await pide("/api/envios", { datos: datosFoto, locale: "es", archivos: archivosFoto });
comprueba("POST /api/envios registra un envío con fotografía", sFoto, 200);

const { data: filaFoto } = await sb.from("envios").select("id").eq("folio", creadoFoto.folio).single();
const { data: adjuntosFoto } = await sb
  .from("envio_archivos")
  .select("storage_path, nombre_publico, mime, bytes, rol")
  .eq("envio_id", filaFoto.id);

comprueba("la extensión del nombre público sale del original, en minúsculas", adjuntosFoto[0].nombre_publico, `${creadoFoto.folio}-01.jpg`);
comprueba("el mime guardado es el que reconoció el servidor, no el que dijo el cliente", adjuntosFoto[0].mime, "image/jpeg");
comprueba("y el rol de la foto llega a la base", adjuntosFoto[0].rol, "foto");

const { data: blobFoto } = await sb.storage.from("manuscritos").download(adjuntosFoto[0].storage_path);
const fotoGuardada = Buffer.from(await blobFoto.arrayBuffer());
const metaGuardada = await sharp(fotoGuardada).metadata();

comprueba("la foto almacenada NO lleva EXIF", Boolean(metaGuardada.exif), false);
comprueba("ni el nombre de la autora por ninguna otra vía", contieneAutor(fotoGuardada), false);
comprueba("el lado largo baja al tope de 3600 px", metaGuardada.width, 3600);
comprueba("pesa menos que la que mandó la autora", fotoGuardada.length < foto.length, true);
comprueba("y los bytes registrados son los de la copia guardada, no los del original", adjuntosFoto[0].bytes, fotoGuardada.length);

// La reducción es el número que justifica no conservar los originales, y sin
// este evento nadie puede comprobarla en producción. Se afirma que existe y que
// es positiva; el rango real (70-85 %) se mide con envíos de verdad, no con una
// imagen fabricada aquí.
const { data: eventos } = await sb.from("envio_eventos").select("tipo, payload").eq("envio_id", filaFoto.id);
const medida = eventos.find((e) => e.tipo === "imagen_optimizada")?.payload?.archivos?.[0];
comprueba("queda anotada la reducción real de la imagen", medida?.reduccion > 0, true);
comprueba("y ninguna imagen queda marcada como no limpiada", eventos.some((e) => e.tipo === "metadatos_no_limpiados"), false);

// ------------------------------------------------------------------ defensas
comprueba("no se puede reutilizar una ruta ya consumida", (await pide("/api/envios", { datos, locale: "es", archivos }))[0], 400);
comprueba("no se puede inventar una ruta que nadie firmó", (await pide("/api/envios", { datos, locale: "es", archivos: [{ path: crypto.randomUUID(), nombre: "m.pdf", bytes: 100, rol: "articulo" }] }))[0], 400);
comprueba("el servidor valida aunque el asistente no", (await pide("/api/envios", { datos: { ...datos, campos: { resumen: palabras(210) } }, locale: "es", archivos }))[1].aviso, "portal_horizonte_resumen_max_200");

const [, f2] = await pide("/api/uploads", { archivos: [{ nombre: "falso.pdf", bytes: 25 }] });
const basura = new FormData();
basura.append("cacheControl", "0");
basura.append("", new Blob([new TextEncoder().encode("no soy un pdf en absoluto")], { type: "application/pdf" }), "falso.pdf");
await fetch(f2.subidas[0].url, { method: "PUT", body: basura });
comprueba("un archivo que no es PDF por dentro se rechaza", (await pide("/api/envios", { datos, locale: "es", archivos: [{ path: f2.subidas[0].path, nombre: "falso.pdf", bytes: 25, rol: "articulo" }] }))[1].aviso, "portal_archivo_tipo");

// -------------------------------------------------------------------- barrido
const { data: huerfanos } = await sb.rpc("subidas_huerfanas", { p_antiguedad: "0 seconds" });
const rutas = huerfanos.map((h) => h.storage_path);
comprueba("el barrido ve el objeto abandonado", rutas.includes(f2.subidas[0].path), true);
comprueba("y no toca el del envío registrado", rutas.includes(adjuntos[0].storage_path), false);

// -------------------------------------------------------------------- limpieza
const { data: todo } = await sb.storage.from("manuscritos").list("", { limit: 1000 });
if (todo.length) await sb.storage.from("manuscritos").remove(todo.map((o) => o.name));
await sb.from("envios").delete().in("id", [fila.id, filaFoto.id]);
await sb.from("envio_folios").delete().neq("anio", 0);

console.log(fallos ? `\n${fallos} comprobaciones fallaron` : "\ntodo bien");
process.exit(fallos ? 1 : 0);
