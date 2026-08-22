import { readFileSync } from "node:fs";
import path from "node:path";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

/**
 * Montaje y desmontaje del escenario del panel.
 *
 * Usa la clave de servicio porque tiene que crear cuentas y sembrar un envío,
 * que es justo lo que la aplicación NO puede hacer con la sesión de nadie. La
 * prueba en sí no la vuelve a tocar: todo lo que verifica pasa por el
 * navegador, con la sesión de una persona real y por tanto con RLS aplicándose.
 */

// Playwright transpila estos archivos a CommonJS, donde import.meta no existe;
// la raíz se resuelve desde el cwd, que es siempre web/.
const RAIZ = process.cwd();

function entorno(): Record<string, string> {
  return Object.fromEntries(
    readFileSync(path.join(RAIZ, ".env.local"), "utf8")
      .split("\n")
      .filter((l) => l.includes("=") && !l.trimStart().startsWith("#"))
      .map((l) => [l.slice(0, l.indexOf("=")), l.slice(l.indexOf("=") + 1)]),
  );
}

export const CLAVE = "prueba-de-panel-2026";

export type Escenario = {
  admin: SupabaseClient;
  envioId: string;
  folio: string;
  correoAutor: string;
  ana: { id: string; correo: string };
  beto: { id: string; correo: string };
};

export async function monta(): Promise<Escenario> {
  const env = entorno();
  const admin = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false },
  });

  const marca = `pw${Date.now()}`;
  const ana = await creaPersona(admin, `ana.${marca}@prueba.test`, "Ana de Prueba");
  const beto = await creaPersona(admin, `beto.${marca}@prueba.test`, "Beto de Prueba");

  // Un envío que ya viene triado, para que la prueba se concentre en la
  // ceguera y no en el triaje. Miradas Económicas es Nivel A: 5 puertas y 5
  // dimensiones, con una crítica.
  const { data: seccion } = await admin
    .from("secciones")
    .select("id")
    .eq("slug", "miradas-economicas")
    .single();

  const correoAutor = `autor.${marca}@prueba.test`;
  const folio = `VTX-2026-${String(Math.floor(Math.random() * 900) + 100)}`;

  const { data: envio } = await admin
    .from("envios")
    .insert({
      folio,
      titulo: `Un manuscrito de prueba ${marca}`,
      seccion_id: seccion!.id,
      resumen: "Resumen de prueba para la suite del panel.",
      palabras_clave: ["a", "b", "c"],
      declaraciones: { d1: true, d2: true, d3: true, d4: true, version: "prueba" },
      declaraciones_at: new Date().toISOString(),
    })
    .select("id")
    .single();

  await admin.from("envios_autoria").insert({
    envio_id: envio!.id,
    nombre: "Nombre Del Autor Secreto",
    correo: correoAutor,
    afiliacion: "Universidad de Prueba",
  });

  return { admin, envioId: envio!.id, folio, correoAutor, ana, beto };
}

async function creaPersona(admin: SupabaseClient, correo: string, nombre: string) {
  const { data, error } = await admin.auth.admin.createUser({
    email: correo,
    password: CLAVE,
    email_confirm: true,
  });
  if (error || !data.user) throw new Error(`no se pudo crear ${correo}: ${error?.message}`);

  await admin.from("usuarios").insert({ id: data.user.id, nombre, email: correo });
  return { id: data.user.id, correo };
}

export async function desmonta(e: Escenario) {
  await e.admin.from("envios").delete().eq("id", e.envioId);
  await e.admin.from("usuarios").delete().in("id", [e.ana.id, e.beto.id]);
  await e.admin.auth.admin.deleteUser(e.ana.id);
  await e.admin.auth.admin.deleteUser(e.beto.id);
}
