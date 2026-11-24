import "server-only";
import { publico } from "@/lib/supabase/publico";

/** La edición que la portada anuncia como parada del recorrido. */
export type EdicionPortada = {
  numero: number;
  portada: string;
  pliegoIzq: string;
  pliegoDer: string;
  /** La página abre directo en esta parada en vez de en la de Vértices. */
  primero: boolean;
};

const urlDe = (ruta: string) => `${process.env.SUPABASE_URL}/storage/v1/object/public/publicaciones/${ruta}`;

/**
 * La edición activa, si está publicada, tiene el switch del panel encendido y
 * sus tres imágenes. Cualquier otra cosa devuelve null y la portada queda como
 * siempre, sin la parada. Que esté publicada lo asegura además la política
 * `ediciones_lectura_publica`: un borrador no llega aquí aunque se pida.
 */
export async function cargaEdicionPortada(): Promise<EdicionPortada | null> {
  const { data, error } = await publico()
    .from("ediciones")
    // `*` y no la lista de columnas: si el sitio se despliega antes de aplicar
    // la migración del segundo switch, una columna nombrada que no existe
    // haría fallar la consulta y la parada desaparecería de la portada.
    .select("*")
    .eq("activa", true)
    .eq("portada_en_carrusel", true)
    .maybeSingle();

  if (error) {
    console.error(JSON.stringify({ nivel: "error", evento: "edicion_portada_no_cargada", error: error.message }));
    return null;
  }
  if (
    !data ||
    data.estado !== "publicada" ||
    !data.carrusel_portada_path ||
    !data.carrusel_pliego_izq_path ||
    !data.carrusel_pliego_der_path
  ) {
    return null;
  }

  return {
    numero: data.numero,
    portada: urlDe(data.carrusel_portada_path),
    pliegoIzq: urlDe(data.carrusel_pliego_izq_path),
    pliegoDer: urlDe(data.carrusel_pliego_der_path),
    primero: data.portada_edicion_primero === true,
  };
}
