import "server-only";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "./tipos";

/**
 * Cliente anónimo, para lo que la revista enseña al público.
 *
 * Deliberadamente NO es el de service_role, aunque el servidor lo tenga a
 * mano. Lo que decide qué artículo es visible es la política
 * `articulos_lectura_publica` —publicados y placeholders, nada más—, y leer
 * con la clave de servicio la saltaría: la portada pasaría a enseñar lo que la
 * consulta pidiera, y bastaría olvidar un `where` para publicar un número que
 * todavía es borrador. Con la clave anónima, esa regla vive en un solo sitio y
 * no en cada pantalla.
 *
 * Corre en el servidor porque la portada se renderiza en el servidor; el
 * navegador sigue sin tener cliente de Supabase (§4.2).
 */

let cliente: SupabaseClient<Database> | null = null;

export function publico(): SupabaseClient<Database> {
  if (cliente) return cliente;

  const url = process.env.SUPABASE_URL;
  const clave = process.env.SUPABASE_PUBLISHABLE_KEY;
  if (!url || !clave) {
    throw new Error("faltan SUPABASE_URL o SUPABASE_PUBLISHABLE_KEY; ver .env.example");
  }

  cliente = createClient<Database>(url, clave, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return cliente;
}
