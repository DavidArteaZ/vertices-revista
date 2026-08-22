import "server-only";
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "./tipos";

/**
 * El cliente del panel: habla con Postgres como la PERSONA que inició sesión,
 * no como service_role.
 *
 * Es la decisión de la etapa 3 y es la que da sentido a toda la suite de RLS.
 * Si el panel usara la clave de servicio, las políticas del doble ciego
 * pasarían a ser una segunda opinión que nadie consulta: la ceguera la
 * decidiría el código de cada pantalla, y bastaría una consulta olvidada para
 * enseñar al autor. Así, la única forma de ver la autoría es que
 * privado.puede_ver_autoria diga que sí.
 *
 * El navegador no tiene cliente de Supabase ni aquí ni en la landing (§4.2).
 * Iniciar y cerrar sesión son acciones de servidor; lo único que viaja al
 * navegador es la cookie de sesión, y es httpOnly.
 */

export async function sesion(): Promise<SupabaseClient<Database>> {
  const almacen = await cookies();

  const url = process.env.SUPABASE_URL;
  const clave = process.env.SUPABASE_PUBLISHABLE_KEY;
  if (!url || !clave) {
    throw new Error("faltan SUPABASE_URL o SUPABASE_PUBLISHABLE_KEY; ver .env.example");
  }

  return createServerClient<Database>(url, clave, {
    cookies: {
      getAll: () => almacen.getAll(),
      setAll: (nuevas) => {
        try {
          nuevas.forEach(({ name, value, options }) => almacen.set(name, value, options));
        } catch {
          // Next no deja escribir cookies durante el render de un componente
          // de servidor. Da igual: el refresco de token lo hace el proxy antes
          // de llegar aquí, así que este catch sólo cubre el caso en que la
          // librería quiera reescribir una cookie que ya está bien.
        }
      },
    },
  });
}

/**
 * Quién es y si sigue siendo del comité.
 *
 * Dos preguntas distintas: `auth.getUser()` dice que la sesión es válida —y lo
 * pregunta al servidor de auth, no se fía del JWT que trae la cookie—, y la
 * fila en `usuarios` dice que además está activa. Dar de baja a alguien es
 * poner `activo = false`, y eso tiene que cerrarle el panel aunque su sesión
 * siga viva.
 */
export type Personal = { id: string; nombre: string; email: string };

export async function personal(): Promise<Personal | null> {
  const sb = await sesion();

  const { data: { user } } = await sb.auth.getUser();
  if (!user) return null;

  const { data } = await sb
    .from("usuarios")
    .select("id, nombre, email")
    .eq("id", user.id)
    .eq("activo", true)
    .maybeSingle();

  return data ?? null;
}
