#!/usr/bin/env node
/**
 * Quita los datos de prueba del proyecto real: envíos, dictámenes, números,
 * artículos que salieron de ellos, archivos de los dos buckets y las cuentas
 * que quedaron de baja.
 *
 * Por defecto **no borra nada**: enseña lo que borraría. Hay que pedirlo:
 *
 *   node scripts/demo/borrar-pruebas.mjs        lista, no toca nada
 *   node scripts/demo/borrar-pruebas.mjs --si   borra
 *
 * No toca las 26 piezas de muestra (`es_placeholder`): son semilla a propósito,
 * para que el descubrimiento por tema y por sección funcione antes del primer
 * número. Se borran cuando haya contenido real, y eso lo decide el comité.
 */

import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createClient } from "@supabase/supabase-js";

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");

const env = Object.fromEntries(
  readFileSync(path.join(RAIZ, ".env.local"), "utf8")
    .split("\n")
    .filter((l) => l.includes("=") && !l.trimStart().startsWith("#"))
    .map((l) => [l.slice(0, l.indexOf("=")), l.slice(l.indexOf("=") + 1).trim()]),
);

const admin = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

const ejecutar = process.argv.includes("--si");

/**
 * Cuentas a quitar además de las que están de baja, por correo y separadas por
 * comas. Hay que nombrarlas una por una a propósito: una cuenta activa es de
 * alguien de verdad, y un script de limpieza no decide eso por su cuenta.
 */
const iCuentas = process.argv.indexOf("--cuentas");
const nombradas = iCuentas === -1 ? [] : (process.argv[iCuentas + 1] ?? "").split(",").filter(Boolean);

const inventario = await censo();
imprime(inventario);

if (!ejecutar) {
  console.log("\nNada borrado. Repite con --si para borrar.\n");
  process.exit(0);
}

await borra(inventario);
imprime(await censo(), "Después");

async function censo() {
  const [envios, articulos, ediciones, usuarios, dictamenes] = await Promise.all([
    admin.from("envios").select("id, folio, titulo, estado"),
    admin.from("articulos").select("id, slug, es_placeholder, envio_id"),
    admin.from("ediciones").select("id, numero, titulo, estado"),
    admin.from("usuarios").select("id, email, nombre, activo"),
    admin.from("dictamenes").select("id"),
  ]);

  const privados = await admin.storage.from("manuscritos").list("", { limit: 1000 });
  const publicos = await admin.storage.from("publicaciones").list("", { limit: 1000 });

  return {
    envios: envios.data ?? [],
    // Sólo los que nacieron de un envío. Las 26 de muestra se quedan.
    articulos: (articulos.data ?? []).filter((a) => !a.es_placeholder),
    muestra: (articulos.data ?? []).filter((a) => a.es_placeholder).length,
    ediciones: ediciones.data ?? [],
    // Las de baja, más las que se hayan nombrado con --cuentas.
    usuarios: (usuarios.data ?? []).filter((u) => !u.activo || nombradas.includes(u.email)),
    activas: (usuarios.data ?? []).filter((u) => u.activo && !nombradas.includes(u.email)),
    dictamenes: (dictamenes.data ?? []).length,
    privados: privados.data ?? [],
    publicos: publicos.data ?? [],
  };
}

function imprime(i, titulo = "Se va a borrar") {
  console.log(`\n${titulo}:\n`);
  for (const e of i.envios) console.log(`  envío     ${e.folio}  ${e.estado.padEnd(11)} ${e.titulo}`);
  for (const a of i.articulos) console.log(`  artículo  ${a.slug}`);
  for (const e of i.ediciones) console.log(`  número    #${e.numero} ${e.estado.padEnd(11)} ${e.titulo}`);
  for (const u of i.usuarios) console.log(`  cuenta    ${u.activo ? "ACTIVA " : "de baja"}  ${u.email}`);
  console.log(`\n  dictámenes ${i.dictamenes} · archivos privados ${i.privados.length} · públicos ${i.publicos.length}`);
  console.log(`  se quedan: ${i.muestra} piezas de muestra`);
  for (const u of i.activas) console.log(`             cuenta activa ${u.email}`);
  console.log();
}

async function borra(i) {
  // Orden importa. Los artículos primero: articulos.envio_id es ON DELETE SET
  // NULL a propósito —quitar un envío no puede dejar en 404 una URL publicada—
  // así que borrar el envío no se los lleva y quedarían huérfanos en la portada.
  if (i.articulos.length) {
    await paso("artículos", () =>
      admin.from("articulos").delete().in("id", i.articulos.map((a) => a.id)));
  }
  if (i.ediciones.length) {
    await paso("números", () =>
      admin.from("ediciones").delete().in("id", i.ediciones.map((e) => e.id)));
  }
  // Los envíos arrastran en cascada autoría, archivos, asignaciones,
  // dictámenes y bitácora.
  if (i.envios.length) {
    await paso("envíos", () =>
      admin.from("envios").delete().in("id", i.envios.map((e) => e.id)));
  }

  await paso("bucket privado", async () => {
    if (!i.privados.length) return { error: null };
    return admin.storage.from("manuscritos").remove(i.privados.map((o) => o.name));
  });

  await paso("bucket público", async () => {
    for (const carpeta of i.publicos) {
      const { data } = await admin.storage.from("publicaciones").list(carpeta.name, { limit: 1000 });
      if (data?.length) {
        await admin.storage.from("publicaciones").remove(data.map((o) => `${carpeta.name}/${o.name}`));
      }
    }
    return { error: null };
  });

  // Al final, cuando ya nada las referencia.
  for (const u of i.usuarios) {
    let { error } = await admin.from("usuarios").delete().eq("id", u.id);

    // Lo que suele quedar enganchado son filas de bitácora sin envío: un
    // `export_generado` no cuelga de ninguno, así que sobrevive al borrado de
    // los envíos y sujeta a su actor. La bitácora es sólo-añadir a propósito y
    // borrar de ahí no es rutina; se hace únicamente para las filas huérfanas
    // de una cuenta que ya se va, nunca para las de un envío vivo.
    if (error) {
      const { error: eEventos } = await admin
        .from("envio_eventos")
        .delete()
        .is("envio_id", null)
        .eq("actor_id", u.id);
      if (!eEventos) ({ error } = await admin.from("usuarios").delete().eq("id", u.id));
    }

    if (error) {
      console.log(`  ! ${u.email} sigue referenciada, se queda de baja: ${error.message}`);
      await admin.from("usuarios").update({ activo: false }).eq("id", u.id);
      continue;
    }
    const { error: eAuth } = await admin.auth.admin.deleteUser(u.id);
    console.log(eAuth ? `  ! Auth de ${u.email}: ${eAuth.message}` : `  ✓ ${u.email}`);
  }
}

async function paso(etiqueta, fn) {
  const { error } = (await fn()) ?? {};
  console.log(error ? `  ! ${etiqueta}: ${error.message}` : `  ✓ ${etiqueta}`);
}
