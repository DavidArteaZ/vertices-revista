import "server-only";
import { servidor } from "@/lib/supabase/servidor";

/**
 * Traduce las etiquetas españolas que manda el formulario a los ids del
 * catálogo.
 *
 * El `<option value>` es español en los seis idiomas (spec §11), así que el
 * servidor recibe siempre la misma cadena y la resuelve aquí. Hacerlo contra
 * la base y no contra una tabla en el código evita que un cambio de catálogo
 * deje al formulario mandando etiquetas que ya no existen: si no resuelve, el
 * envío se rechaza en vez de guardarse con un id inventado.
 */

type Catalogo = {
  secciones: Map<string, number>;
  temas: Map<string, number>;
  tipos: Map<string, number>;
};

/** Se cargan una vez por proceso: son 46 filas sembradas que no cambian solas. */
let cache: Promise<Catalogo> | null = null;

export function catalogos(): Promise<Catalogo> {
  cache ??= cargar();
  return cache;
}

async function cargar(): Promise<Catalogo> {
  const sb = servidor();
  const [s, t, p] = await Promise.all([
    sb.from("secciones").select("id, nombre_display, nombre_canonico"),
    sb.from("temas").select("id, nombre"),
    sb.from("tipos_pieza").select("id, nombre"),
  ]);

  const problema = s.error ?? t.error ?? p.error;
  if (problema) {
    cache = null; // que el siguiente intento vuelva a probar
    throw new Error(`no se pudieron cargar los catálogos: ${problema.message}`);
  }

  const secciones = new Map<string, number>();
  for (const fila of s.data ?? []) {
    secciones.set(fila.nombre_display, fila.id);
    secciones.set(fila.nombre_canonico, fila.id);
  }
  // El formulario ofrece "Aún no lo decido"; el catálogo lo llama
  // "Por asignar", que es la sección sin nivel y por tanto sin instrumento de
  // dictamen hasta que el comité la triaje.
  const porAsignar = secciones.get("Por asignar");
  if (porAsignar) secciones.set("Aún no lo decido", porAsignar);

  return {
    secciones,
    temas: new Map((t.data ?? []).map((f) => [f.nombre, f.id])),
    tipos: new Map((p.data ?? []).map((f) => [f.nombre, f.id])),
  };
}
