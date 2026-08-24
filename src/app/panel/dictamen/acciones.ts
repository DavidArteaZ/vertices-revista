"use server";

import { revalidatePath } from "next/cache";
import { sesion, personal } from "@/lib/supabase/sesion";
import { cargaRubrica, cargaRespuestas } from "@/lib/dictamen/cargar";
import { decidir } from "@/lib/dictamen/decidir";
import type { Resultado } from "../acciones";

/**
 * Guardar y enviar una tarjeta de dictamen.
 *
 * La semántica de tres estados del libro se conserva byte a byte en el camino
 * formulario → base:
 *
 *   sin marcar   → NO se escribe fila. Una puerta sin contestar reprueba, y una
 *                  dimensión sin calificar no cuenta para el puntaje.
 *   "na"         → fila con null. Sólo donde permite_na, y hay exactamente una
 *                  dimensión así en todo el libro; un disparador rechaza el
 *                  resto.
 *   valor        → fila con el valor.
 *
 * Es tentador escribir null para "sin marcar" y ahorrarse el borrado. Sería un
 * error: null significa N/A, y N/A saca a la dimensión del máximo. Un dictamen
 * a medias pasaría a parecer un dictamen completo con dimensiones no
 * aplicables, y el veredicto saldría más favorable de lo que es.
 */

const NO_AUTORIZADO: Resultado = { ok: false, mensaje: "No tienes acceso al panel." };

type Cambios = {
  puertas: { puerta_id: number; valor: boolean | null }[];
  puntajes: { dimension_id: number; valor: number | null }[];
  borrarPuertas: number[];
  borrarPuntajes: number[];
};

function leeFormulario(datos: FormData): Cambios {
  const cambios: Cambios = { puertas: [], puntajes: [], borrarPuertas: [], borrarPuntajes: [] };

  for (const [nombre, crudo] of datos.entries()) {
    const valor = String(crudo);

    const puerta = nombre.match(/^puerta_(\d+)$/);
    if (puerta) {
      const id = Number(puerta[1]);
      if (valor === "") cambios.borrarPuertas.push(id);
      else cambios.puertas.push({ puerta_id: id, valor: valor === "si" });
      continue;
    }

    const dim = nombre.match(/^dim_(\d+)$/);
    if (dim) {
      const id = Number(dim[1]);
      if (valor === "") cambios.borrarPuntajes.push(id);
      else if (valor === "na") cambios.puntajes.push({ dimension_id: id, valor: null });
      else cambios.puntajes.push({ dimension_id: id, valor: Number(valor) });
    }
  }

  return cambios;
}

async function escribe(dictamen: string, datos: FormData): Promise<string | null> {
  const sb = await sesion();
  const { puertas, puntajes, borrarPuertas, borrarPuntajes } = leeFormulario(datos);

  const comentarios = String(datos.get("comentarios") ?? "").trim();
  const sinConflicto = datos.get("sin_conflicto") === "on";

  const { error: eCabecera } = await sb
    .from("dictamenes")
    .update({ comentarios: comentarios || null, sin_conflicto: sinConflicto, updated_at: new Date().toISOString() })
    .eq("id", dictamen);
  if (eCabecera) return eCabecera.message;

  if (borrarPuertas.length) {
    await sb.from("dictamen_puertas").delete().eq("dictamen_id", dictamen).in("puerta_id", borrarPuertas);
  }
  if (borrarPuntajes.length) {
    await sb.from("dictamen_puntajes").delete().eq("dictamen_id", dictamen).in("dimension_id", borrarPuntajes);
  }

  if (puertas.length) {
    const { error } = await sb
      .from("dictamen_puertas")
      .upsert(puertas.map((p) => ({ ...p, dictamen_id: dictamen })), { onConflict: "dictamen_id,puerta_id" });
    if (error) return error.message;
  }
  if (puntajes.length) {
    const { error } = await sb
      .from("dictamen_puntajes")
      .upsert(puntajes.map((p) => ({ ...p, dictamen_id: dictamen })), { onConflict: "dictamen_id,dimension_id" });
    if (error) return error.message;
  }

  return null;
}

export async function guardarBorrador(datos: FormData): Promise<Resultado> {
  if (!(await personal())) return NO_AUTORIZADO;

  const dictamen = String(datos.get("dictamen") ?? "");
  const problema = await escribe(dictamen, datos);
  if (problema) return { ok: false, mensaje: problema };

  revalidatePath(`/panel/dictamen/${dictamen}`);
  return { ok: true, mensaje: "Borrador guardado." };
}

export async function enviar(datos: FormData): Promise<Resultado> {
  if (!(await personal())) return NO_AUTORIZADO;

  const dictamen = String(datos.get("dictamen") ?? "");

  // Se guarda primero: enviar una tarjeta distinta de la que se está viendo
  // sería la peor forma de perder trabajo, y la transición no se puede
  // deshacer.
  const problema = await escribe(dictamen, datos);
  if (problema) return { ok: false, mensaje: problema };

  const sb = await sesion();
  const { data: cabecera } = await sb
    .from("dictamenes")
    .select("id, envio_id, rubrica_version_id, sin_conflicto")
    .eq("id", dictamen)
    .maybeSingle();

  if (!cabecera) return { ok: false, mensaje: "No encuentro ese dictamen." };

  // El correo no detecta la coautoría, así que la autodeclaración es la única
  // barrera que hay contra ella (spec §7.3).
  if (!cabecera.sin_conflicto) {
    return {
      ok: false,
      mensaje: "Confirma que no participaste en la elaboración de esta pieza.",
    };
  }

  const rubrica = await cargaRubrica(sb, cabecera.rubrica_version_id);
  if (!rubrica) return { ok: false, mensaje: "No encuentro la rúbrica del dictamen." };

  const respuestas = await cargaRespuestas(sb, dictamen);

  let veredicto;
  try {
    veredicto = decidir(rubrica, respuestas);
  } catch (e) {
    return { ok: false, mensaje: (e as Error).message };
  }

  if (veredicto.motivo === "pendiente") {
    return { ok: false, mensaje: "No has calificado ninguna dimensión." };
  }

  // La instantánea la calcula el servidor y se guarda tal cual. El disparador
  // de la base comprueba además que la tarjeta esté completa —toda puerta ★
  // contestada y toda dimensión calificada salvo la que admite N/A—, así que
  // una tarjeta a medias no puede desvelar la autoría.
  const { error } = await sb.rpc("enviar_dictamen", {
    p_dictamen: dictamen,
    p_puntaje: veredicto.puntaje,
    p_maximo: veredicto.maximo,
    p_puertas_ok: veredicto.puertasOk,
    p_criticos_ok: veredicto.criticosOk,
    p_decision: veredicto.decision.id,
    p_comentarios: String(datos.get("comentarios") ?? "").trim() || null,
  });

  if (error) return { ok: false, mensaje: error.message };

  revalidatePath(`/panel/dictamen/${dictamen}`);
  revalidatePath(`/panel/envios/${cabecera.envio_id}`);
  return { ok: true, mensaje: `Dictamen enviado: ${veredicto.decision.etiqueta}` };
}
