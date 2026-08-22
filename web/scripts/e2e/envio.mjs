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
 * Al terminar borra lo que creó.
 */
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { PDFDocument } from "pdf-lib";
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
// uno cada vez que se corre, y desde localhost todas las corridas comparten
// huella. No se puede reiniciar desde aquí —privado no está expuesto por
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
  genero: "",
  titulo: "Un manuscrito de prueba de extremo a extremo",
  // Paper + Horizonte Global es la excepción del libro: sube a Nivel A y se
  // dictamina con el instrumento de Miradas Económicas.
  formato: "Paper/Investigación",
  seccion: "Horizonte Global",
  tema: "Macroeconomía",
  resumen: Array.from({ length: 130 }, (_, i) => `palabra${i}`).join(" "),
  claves: "inflación, tipo de cambio, tasas",
  usoIA: "No",
  d1: true, d2: true, d3: true, d4: true,
};

const archivos = [{ path: firmada.path, nombre: "Mi Manuscrito.PDF", bytes: bytes.length }];
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
  .select("id, nivel, es_investigacion, declaraciones, seccion_dictamen_id, secciones!envios_seccion_dictamen_id_fkey(slug)")
  .eq("folio", creado.folio)
  .single();

comprueba("Horizonte Global + Paper enruta a Nivel A", fila.nivel, "A");
comprueba("y al instrumento de Miradas Económicas", fila.secciones?.slug, "miradas-economicas");
comprueba("es_investigacion se deriva del tipo, no del cuerpo", fila.es_investigacion, true);
comprueba("las cuatro declaraciones quedan guardadas", [fila.declaraciones.d1, fila.declaraciones.d2, fila.declaraciones.d3, fila.declaraciones.d4], [true, true, true, true]);
comprueba("con la versión del texto aceptado", typeof fila.declaraciones.version, "string");

const { data: adjuntos } = await sb
  .from("envio_archivos")
  .select("storage_path, nombre_publico, mime")
  .eq("envio_id", fila.id);

comprueba("el nombre público no viene del nombre original", adjuntos[0].nombre_publico, `${creado.folio}-01.pdf`);

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

// ------------------------------------------------------------------ defensas
comprueba("no se puede reutilizar una ruta ya consumida", (await pide("/api/envios", { datos, locale: "es", archivos }))[0], 400);
comprueba("no se puede inventar una ruta que nadie firmó", (await pide("/api/envios", { datos, locale: "es", archivos: [{ path: crypto.randomUUID(), nombre: "m.pdf", bytes: 100 }] }))[0], 400);
comprueba("el servidor valida aunque el asistente no", (await pide("/api/envios", { datos: { ...datos, resumen: "corto" }, locale: "es", archivos }))[1].aviso, "el_resumen_lleva_n_palabras_se_piden_al_menos_10_c4d7");

const [, f2] = await pide("/api/uploads", { archivos: [{ nombre: "falso.pdf", bytes: 25 }] });
const basura = new FormData();
basura.append("cacheControl", "0");
basura.append("", new Blob([new TextEncoder().encode("no soy un pdf en absoluto")], { type: "application/pdf" }), "falso.pdf");
await fetch(f2.subidas[0].url, { method: "PUT", body: basura });
comprueba("un archivo que no es PDF por dentro se rechaza", (await pide("/api/envios", { datos, locale: "es", archivos: [{ path: f2.subidas[0].path, nombre: "falso.pdf", bytes: 25 }] }))[1].aviso, "a_no_es_un_pdf_ni_un_documento_de_word");

// -------------------------------------------------------------------- barrido
const { data: huerfanos } = await sb.rpc("subidas_huerfanas", { p_antiguedad: "0 seconds" });
const rutas = huerfanos.map((h) => h.storage_path);
comprueba("el barrido ve el objeto abandonado", rutas.includes(f2.subidas[0].path), true);
comprueba("y no toca el del envío registrado", rutas.includes(adjuntos[0].storage_path), false);

// -------------------------------------------------------------------- limpieza
const { data: todo } = await sb.storage.from("manuscritos").list("", { limit: 1000 });
if (todo.length) await sb.storage.from("manuscritos").remove(todo.map((o) => o.name));
await sb.from("envios").delete().eq("id", fila.id);
await sb.from("envio_folios").delete().neq("anio", 0);

console.log(fallos ? `\n${fallos} comprobaciones fallaron` : "\ntodo bien");
process.exit(fallos ? 1 : 0);
