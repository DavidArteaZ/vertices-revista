import "server-only";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "./tipos";

/**
 * El cliente con la clave de servicio. Salta RLS por completo, así que sólo lo
 * pueden importar módulos de servidor: `server-only` convierte en error de
 * compilación cualquier ruta de importación que acabe en un bundle de cliente.
 * Es la garantía que pide §13, y es de compilación y no de disciplina.
 *
 * El navegador no tiene ningún cliente de Supabase, ni siquiera anónimo (regla
 * de §4.2): sube a una URL firmada que le entrega POST /api/uploads y consulta
 * su estado por POST /api/estado. Nada más.
 */

let cliente: SupabaseClient<Database> | null = null;

export function servidor(): SupabaseClient<Database> {
  if (cliente) return cliente;

  const url = process.env.SUPABASE_URL;
  const clave = process.env.SUPABASE_SERVICE_ROLE_KEY;

  // Fallar aquí y no en la primera consulta: un despliegue sin configurar debe
  // romperse de forma legible, no devolver un 500 opaco con el manuscrito de
  // alguien dentro.
  if (!url || !clave) {
    throw new Error(
      "faltan SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY; ver .env.example",
    );
  }

  cliente = createClient<Database>(url, clave, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return cliente;
}

export const BUCKET_PRIVADO = "manuscritos";
export const BUCKET_PUBLICO = "publicaciones";
