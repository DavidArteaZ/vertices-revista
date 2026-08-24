#!/usr/bin/env node
/**
 * Cuentas de demostración para probar el panel a mano.
 *
 * El alta del comité es por invitación por correo (spec §13) y eso exige un
 * dominio verificado, así que en local no hay forma de entrar al panel por la
 * interfaz. Este script crea las dos cuentas con contraseña usando la clave de
 * servicio — exactamente lo que hace el fixture de Playwright, pero sin borrar
 * al terminar.
 *
 * Son dos porque el doble ciego es una función de (quién mira, qué envío): con
 * una sola cuenta no se puede ver que una persona desvele y la otra siga ciega.
 *
 *   node scripts/demo/sembrar.mjs            crea las cuentas
 *   node scripts/demo/sembrar.mjs --estado   sólo informa, no escribe
 *   node scripts/demo/sembrar.mjs --limpiar  las borra
 *   node scripts/demo/sembrar.mjs --purgar   borra además las de @prueba.test
 *                                            que dejen las suites de Playwright
 *
 * Y el alta de una persona de verdad, que es otra cosa: se crea sin contraseña
 * y se le devuelve un enlace para que la elija ella. Sirve para arrancar el
 * comité mientras el correo no salga del dominio de pruebas de Resend.
 *
 *   node scripts/demo/sembrar.mjs --alta correo@dominio "Nombre" [https://sitio]
 *   node scripts/demo/sembrar.mjs --enlace correo@dominio [https://sitio]
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

export const CLAVE = "demo-vertices-2026";

const PERSONAS = [
  { correo: "ana@demo.test", nombre: "Ana Demo" },
  { correo: "beto@demo.test", nombre: "Beto Demo" },
];

const modo = process.argv[2] ?? "";

if (modo === "--limpiar") await limpiar();
else if (modo === "--purgar") await purgar();
else if (modo === "--alta") await alta(...process.argv.slice(3));
else if (modo === "--enlace") await enlace(...process.argv.slice(3));
else if (modo !== "--estado") await sembrar();
await estado();

/**
 * Alta de una persona real. Sin contraseña a propósito: la elige ella con el
 * enlace, y así no hay ninguna contraseña conocida circulando por aquí.
 */
async function alta(correo, nombre, sitio) {
  if (!correo || !nombre) throw new Error('uso: --alta correo@dominio "Nombre" [https://sitio]');

  let id = await buscaAuth(correo);
  if (!id) {
    const { data, error } = await admin.auth.admin.createUser({ email: correo, email_confirm: true });
    if (error || !data.user) throw new Error(`no se pudo crear ${correo}: ${error?.message}`);
    id = data.user.id;
  }

  // La fila en `usuarios` es lo que da acceso, no la cuenta de Auth: es lo que
  // mira privado.es_staff(). Una cuenta sin fila aquí entra y no ve nada.
  const { error } = await admin.from("usuarios").upsert({ id, nombre, email: correo, activo: true });
  if (error) throw new Error(error.message);

  console.log(`✓ ${correo} dada de alta en el comité`);
  await enlace(correo, sitio);
}

/**
 * Enlace para elegir contraseña.
 *
 * Va directo al callback de la app con `token_hash`, no al `action_link` que
 * devuelve Supabase. Ése pasa antes por /auth/v1/verify, que entrega la sesión
 * en el fragmento de la URL —`#access_token=…`— y el fragmento no viaja al
 * servidor: el route handler no ve nada y manda a la pantalla de entrar. Con
 * el token_hash el canje ocurre entero en el servidor.
 */
async function enlace(correo, sitio = "http://localhost:3100") {
  const base = sitio.replace(/\/$/, "");

  const { data, error } = await admin.auth.admin.generateLink({
    type: "recovery",
    email: correo,
    options: { redirectTo: `${base}/panel/clave` },
  });
  if (error) throw new Error(error.message);

  const url = `${base}/panel/auth/callback?token_hash=${data.properties.hashed_token}` +
    `&type=recovery&siguiente=/panel/clave`;

  console.log(`\nEnlace de un solo uso para ${correo}:\n${url}\n`);
}

async function sembrar() {
  for (const p of PERSONAS) {
    const id = (await buscaAuth(p.correo)) ?? (await creaAuth(p.correo));
    await admin.from("usuarios").upsert({ id, nombre: p.nombre, email: p.correo, activo: true });
    console.log(`✓ ${p.correo}`);
  }
  console.log(`\nContraseña de las dos: ${CLAVE}\n`);
}

async function limpiar() {
  for (const p of PERSONAS) await retira(p.correo);
  console.log();
}

/**
 * Retirar una cuenta de prueba.
 *
 * Borrarla no siempre se puede, y ése es el diseño: en cuanto la persona
 * dictamina o graba una decisión, su fila queda referenciada y la base se
 * niega a soltarla — borrarla destruiría la instantánea de lo que el comité
 * vio. Cuando pasa, la baja (`activo = false`) es la salida correcta, y la
 * contraseña se rota igual para que la conocida deje de servir.
 *
 * La primera versión ignoraba el error del borrado e imprimía «✓ borrada» de
 * todos modos. Una cuenta de demostración con contraseña pública siguió viva
 * en un panel ya publicado.
 */
async function retira(correo) {
  const id = await buscaAuth(correo);
  if (!id) return;

  // Antes que nada: la contraseña conocida deja de valer, pase lo que pase
  // después.
  const { error: eClave } = await admin.auth.admin.updateUserById(id, {
    password: crypto.randomUUID() + crypto.randomUUID(),
  });
  if (eClave) console.error(`  ! no se pudo rotar la contraseña de ${correo}: ${eClave.message}`);

  const { error: eFila } = await admin.from("usuarios").delete().eq("id", id);
  if (eFila) {
    // Referenciada por dictámenes o decisiones: baja, no borrado.
    const { error: eBaja } = await admin.from("usuarios").update({ activo: false }).eq("id", id);
    if (eBaja) throw new Error(`${correo}: ni borrar ni dar de baja: ${eBaja.message}`);
    console.log(`✓ ${correo} dada de baja (tiene dictámenes; no se puede borrar) y contraseña rotada`);
    return;
  }

  const { error: eAuth } = await admin.auth.admin.deleteUser(id);
  if (eAuth) {
    console.log(`✓ ${correo} fuera del comité; la cuenta de Auth queda, sin acceso: ${eAuth.message}`);
    return;
  }
  console.log(`✓ borrada ${correo}`);
}

/**
 * Restos de las suites de Playwright. `desmonta` limpia al terminar, pero una
 * corrida interrumpida deja cuentas atrás y ensucian el equipo y el selector de
 * asignaciones.
 */
async function purgar() {
  const { data: personas } = await admin.from("usuarios").select("email").like("email", "%@prueba.test");
  for (const p of personas ?? []) await retira(p.email);
  console.log();
}

/** listUsers pagina; con un puñado de cuentas la primera página basta. */
async function buscaAuth(correo) {
  const { data, error } = await admin.auth.admin.listUsers({ perPage: 200 });
  if (error) throw new Error(error.message);
  return data.users.find((u) => u.email === correo)?.id ?? null;
}

async function creaAuth(correo) {
  const { data, error } = await admin.auth.admin.createUser({
    email: correo,
    password: CLAVE,
    email_confirm: true,
  });
  if (error || !data.user) throw new Error(`no se pudo crear ${correo}: ${error?.message}`);
  return data.user.id;
}

async function estado() {
  const filas = [];
  for (const t of ["usuarios", "envios", "articulos", "ediciones", "secciones", "temas"]) {
    const { count, error } = await admin.from(t).select("id", { count: "exact", head: true });
    filas.push(`${t.padEnd(12)} ${error ? "ERROR " + error.message : count}`);
  }
  console.log(filas.join("\n"));

  const { data: personas } = await admin.from("usuarios").select("nombre, email, activo").order("nombre");
  if (personas?.length) {
    console.log("\ncomité:");
    for (const p of personas) console.log(`  ${p.activo ? " " : "×"} ${p.email.padEnd(28)} ${p.nombre}`);
  }

  const { data: envios } = await admin
    .from("envios")
    .select("folio, titulo, estado")
    .order("creado_at", { ascending: false })
    .limit(10);
  if (envios?.length) {
    console.log("\núltimos envíos:");
    for (const e of envios) console.log(`  ${e.folio}  ${e.estado.padEnd(12)} ${e.titulo}`);
  }
}
