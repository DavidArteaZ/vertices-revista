import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/tipos";
import type { Respuestas, Rubrica } from "./rubrica";

/**
 * Arma una `Rubrica` del motor a partir de las filas sembradas.
 *
 * El motor no sabe nada de Postgres —se prueba con objetos literales, y por eso
 * las 205 pruebas de decidir.ts corren sin base—, así que la traducción vive
 * aquí y en un solo sitio. La versión que se carga es la del dictamen, no la
 * vigente: si el comité publica una revisión del instrumento a mitad de un
 * dictamen, esa tarjeta se sigue evaluando con la que se abrió.
 */
export async function cargaRubrica(
  sb: SupabaseClient<Database>,
  rubricaVersionId: number,
): Promise<Rubrica | null> {
  const [{ data: version }, { data: puertas }, { data: dimensiones }, { data: decisiones }, { data: bandas }] =
    await Promise.all([
      sb
        .from("rubrica_versiones")
        .select("id, etiqueta_falla_puerta, etiqueta_falla_critico, etiqueta_pendiente")
        .eq("id", rubricaVersionId)
        .maybeSingle(),
      sb.from("rubrica_puertas").select("*").eq("rubrica_version_id", rubricaVersionId).order("orden"),
      sb.from("rubrica_dimensiones").select("*").eq("rubrica_version_id", rubricaVersionId).order("orden"),
      sb.from("decisiones").select("*").eq("rubrica_version_id", rubricaVersionId).order("orden"),
      sb.from("bandas_decision").select("*").eq("rubrica_version_id", rubricaVersionId),
    ]);

  if (!version) return null;

  return {
    id: version.id,
    etiquetaFallaPuerta: version.etiqueta_falla_puerta,
    etiquetaFallaCritico: version.etiqueta_falla_critico,
    etiquetaPendiente: version.etiqueta_pendiente,
    puertas: (puertas ?? []).map((p) => ({
      id: p.id,
      etiqueta: p.etiqueta,
      esEliminatoria: p.es_eliminatoria,
    })),
    dimensiones: (dimensiones ?? []).map((d) => ({
      id: d.id,
      etiqueta: d.etiqueta,
      esCritica: d.es_critica,
      peso: d.peso,
      permiteNa: d.permite_na,
    })),
    decisiones: (decisiones ?? []).map((d) => ({
      id: d.id,
      etiqueta: d.etiqueta,
      esAceptante: d.es_aceptante,
      esFalla: d.es_falla,
    })),
    bandas: (bandas ?? []).map((b) => ({
      variante: b.variante,
      minPuntaje: b.min_puntaje,
      decisionId: b.decision_id,
    })),
  };
}

/**
 * Las respuestas guardadas, con la semántica de tres estados intacta: una fila
 * ausente NO es lo mismo que una fila con null. La primera es "sin contestar";
 * la segunda, sólo en las dimensiones que lo admiten, es N/A. Confundirlas
 * cambia el veredicto, así que nada de `?? null` por el camino.
 */
export async function cargaRespuestas(
  sb: SupabaseClient<Database>,
  dictamenId: string,
): Promise<Respuestas> {
  const [{ data: puertas }, { data: puntajes }] = await Promise.all([
    sb.from("dictamen_puertas").select("puerta_id, valor").eq("dictamen_id", dictamenId),
    sb.from("dictamen_puntajes").select("dimension_id, valor").eq("dictamen_id", dictamenId),
  ]);

  return {
    puertas: new Map((puertas ?? []).map((p) => [p.puerta_id, p.valor])),
    puntajes: new Map((puntajes ?? []).map((p) => [p.dimension_id, p.valor])),
  };
}
