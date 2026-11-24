"use server";

import { revalidatePath } from "next/cache";
import { sesion, personal } from "@/lib/supabase/sesion";
import { servidor, BUCKET_PUBLICO } from "@/lib/supabase/servidor";
import type { Resultado } from "../acciones";
import { HUECOS_CARRUSEL, type HuecoCarrusel } from "./pdf";

/**
 * La edición en la portada: sus tres imágenes y el switch que la enciende.
 *
 * El switch sólo se enciende si la edición es la activa, está publicada y
 * tiene las tres imágenes. Apagarlo siempre se puede. La portada vuelve a
 * comprobar todo al leer, así que si después se cambia la edición activa la
 * parada desaparece sola.
 */

const NO_AUTORIZADO: Resultado = { ok: false, mensaje: "No tienes acceso al panel." };

const COLUMNA: Record<HuecoCarrusel, "carrusel_portada_path" | "carrusel_pliego_izq_path" | "carrusel_pliego_der_path"> = {
  portada: "carrusel_portada_path",
  "pliego-izq": "carrusel_pliego_izq_path",
  "pliego-der": "carrusel_pliego_der_path",
};

function falloLectura(edicion: number, error: string): Resultado {
  console.error(JSON.stringify({ evento: "panel_carrusel_lectura_fallo", edicion, error }));
  return { ok: false, mensaje: `La base no pudo leer la edición: ${error}` };
}

function refrescar(edicion: number) {
  revalidatePath(`/panel/ediciones/${edicion}`);
  // La portada se sirve estática (revalidate = 300); esto la rehace ya.
  revalidatePath("/[locale]", "page");
}

export async function fijarImagenCarrusel(datos: FormData): Promise<Resultado> {
  if (!(await personal())) return NO_AUTORIZADO;

  const edicion = Number(datos.get("edicion") ?? 0);
  const hueco = HUECOS_CARRUSEL.find((h) => h === datos.get("hueco"));
  const ruta = String(datos.get("ruta") ?? "");
  if (!edicion || !hueco) return { ok: false, mensaje: "Falta la edición o la imagen." };
  if (!ruta.startsWith(`${edicion}/carrusel-${hueco}-`)) {
    return { ok: false, mensaje: "La ruta de la imagen no corresponde a esta edición." };
  }

  const columna = COLUMNA[hueco];
  const sb = await sesion();
  const { data: fila, error: eLectura } = await sb
    .from("ediciones")
    .select("id, carrusel_portada_path, carrusel_pliego_izq_path, carrusel_pliego_der_path")
    .eq("id", edicion)
    .maybeSingle();
  // Un fallo de la consulta (p. ej. columnas que faltan porque la migración no
  // se aplicó) no es "no existe": se dice tal cual para poder arreglarlo.
  if (eLectura) return falloLectura(edicion, eLectura.message);
  if (!fila) return { ok: false, mensaje: "No se encontró la edición." };
  const anterior = fila[columna];

  const cambio: Partial<Record<typeof columna, string>> = { [columna]: ruta };
  const { error } = await sb.from("ediciones").update(cambio).eq("id", edicion);
  if (error) return { ok: false, mensaje: error.message };

  if (anterior && anterior !== ruta) {
    const { error: eBorrado } = await servidor().storage.from(BUCKET_PUBLICO).remove([anterior]);
    if (eBorrado) {
      console.error(JSON.stringify({ evento: "panel_carrusel_vieja_fallo", edicion, hueco, error: eBorrado.message }));
    }
  }

  refrescar(edicion);
  return { ok: true, mensaje: "Imagen actualizada." };
}

export async function cambiarCarrusel(datos: FormData): Promise<Resultado> {
  if (!(await personal())) return NO_AUTORIZADO;

  const edicion = Number(datos.get("edicion") ?? 0);
  const encender = datos.get("encender") === "1";
  if (!edicion) return { ok: false, mensaje: "Falta la edición." };

  const sb = await sesion();

  if (encender) {
    const { data: e, error: eLectura } = await sb
      .from("ediciones")
      .select("activa, estado, carrusel_portada_path, carrusel_pliego_izq_path, carrusel_pliego_der_path")
      .eq("id", edicion)
      .maybeSingle();
    if (eLectura) return falloLectura(edicion, eLectura.message);
    if (!e) return { ok: false, mensaje: "No se encontró la edición." };
    if (!e.activa) return { ok: false, mensaje: "Sólo se puede encender en la edición activa." };
    if (e.estado !== "publicada") return { ok: false, mensaje: "Primero hay que publicar el número." };
    if (!e.carrusel_portada_path || !e.carrusel_pliego_izq_path || !e.carrusel_pliego_der_path) {
      return { ok: false, mensaje: "Faltan imágenes: sube la portada y los dos pliegos." };
    }
  }

  const { error } = await sb.from("ediciones").update({ portada_en_carrusel: encender }).eq("id", edicion);
  if (error) {
    console.error(JSON.stringify({ evento: "panel_carrusel_switch_fallo", edicion, error: error.message }));
    return { ok: false, mensaje: error.message };
  }

  refrescar(edicion);
  return { ok: true, mensaje: encender ? "La edición ya aparece en la portada." : "La edición ya no aparece en la portada." };
}

/**
 * El segundo switch: si la portada abre directo en la parada de la edición.
 * Sólo se enciende con la parada encendida; apagarlo siempre se puede.
 */
export async function cambiarPrimero(datos: FormData): Promise<Resultado> {
  if (!(await personal())) return NO_AUTORIZADO;

  const edicion = Number(datos.get("edicion") ?? 0);
  const encender = datos.get("encender") === "1";
  if (!edicion) return { ok: false, mensaje: "Falta la edición." };

  const sb = await sesion();

  if (encender) {
    const { data: e, error: eLectura } = await sb
      .from("ediciones")
      .select("portada_en_carrusel")
      .eq("id", edicion)
      .maybeSingle();
    if (eLectura) return falloLectura(edicion, eLectura.message);
    if (!e) return { ok: false, mensaje: "No se encontró la edición." };
    if (!e.portada_en_carrusel) return { ok: false, mensaje: "Primero enciende la edición en la portada." };
  }

  const { error } = await sb.from("ediciones").update({ portada_edicion_primero: encender }).eq("id", edicion);
  if (error) {
    console.error(JSON.stringify({ evento: "panel_carrusel_primero_fallo", edicion, error: error.message }));
    return { ok: false, mensaje: error.message };
  }

  refrescar(edicion);
  return {
    ok: true,
    mensaje: encender ? "La portada ya abre en la edición." : "La portada vuelve a abrir en Vértices.",
  };
}
