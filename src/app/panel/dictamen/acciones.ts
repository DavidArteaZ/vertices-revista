"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { sesion, personal } from "@/lib/supabase/sesion";
import { servidor, BUCKET_PRIVADO } from "@/lib/supabase/servidor";
import { cargaRubrica, cargaRespuestas } from "@/lib/dictamen/cargar";
import { decidir } from "@/lib/dictamen/decidir";
import { enviarDictamen } from "@/lib/correo/dictamen";
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

const MAX_ARCHIVO_DOBLE_CIEGO = 20 * 1024 * 1024;
const MIME_PDF = "application/pdf";
const MIME_DOCX = "application/vnd.openxmlformats-officedocument.wordprocessingml.document";

function tipoArchivoDobleCiego(archivo: File): { extension: "pdf" | "docx"; mime: string } | null {
  const nombre = archivo.name.toLowerCase();
  if (nombre.endsWith(".pdf")) return { extension: "pdf", mime: MIME_PDF };
  if (nombre.endsWith(".docx")) return { extension: "docx", mime: MIME_DOCX };
  return null;
}

function firmaValida(contenido: Buffer, extension: "pdf" | "docx"): boolean {
  if (extension === "pdf") return contenido.subarray(0, 5).toString("ascii") === "%PDF-";
  return contenido.length >= 4 && contenido[0] === 0x50 && contenido[1] === 0x4b;
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
  const quien = await personal();
  if (!quien) return NO_AUTORIZADO;

  const dictamen = String(datos.get("dictamen") ?? "");

  // Se guarda primero: enviar una tarjeta distinta de la que se está viendo
  // sería la peor forma de perder trabajo, y la transición no se puede
  // deshacer.
  const problema = await escribe(dictamen, datos);
  if (problema) return { ok: false, mensaje: problema };

  const sb = await sesion();
  const { data: cabecera } = await sb
    .from("dictamenes")
    .select("id, envio_id, revisor_id, rubrica_version_id, sin_conflicto, estado")
    .eq("id", dictamen)
    .maybeSingle();

  if (!cabecera || cabecera.revisor_id !== quien.id) {
    return { ok: false, mensaje: "No encuentro ese dictamen entre tus asignaciones." };
  }
  if (cabecera.estado === "enviado") {
    return { ok: false, mensaje: "Este dictamen ya fue enviado." };
  }

  // El correo no detecta la coautoría, así que la autodeclaración es la única
  // barrera que hay contra ella (spec §7.3).
  if (!cabecera.sin_conflicto) {
    return {
      ok: false,
      mensaje: "Confirma que no participaste en la elaboración de esta pieza.",
    };
  }

  const [{ data: pieza }, { data: archivoExistente }] = await Promise.all([
    sb.from("envios").select("titulo").eq("id", cabecera.envio_id).maybeSingle(),
    sb
      .from("dictamen_archivos")
      .select("dictamen_id, storage_path, nombre_original, mime, bytes, guardado_at")
      .eq("dictamen_id", dictamen)
      .maybeSingle(),
  ]);

  if (!pieza) return { ok: false, mensaje: "No encuentro la pieza de este dictamen." };

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

  let archivoGuardado = archivoExistente;
  let contenidoAdjunto: Buffer | null = null;
  const archivoFormulario = datos.get("doble_ciego");

  if (archivoFormulario instanceof File && archivoFormulario.size > 0) {
    const tipo = tipoArchivoDobleCiego(archivoFormulario);
    if (!tipo) {
      return { ok: false, mensaje: "La plantilla llenada debe ser un archivo PDF o DOCX." };
    }
    if (archivoFormulario.size > MAX_ARCHIVO_DOBLE_CIEGO) {
      return { ok: false, mensaje: "La plantilla llenada no puede superar 20 MB." };
    }

    contenidoAdjunto = Buffer.from(await archivoFormulario.arrayBuffer());
    if (!firmaValida(contenidoAdjunto, tipo.extension)) {
      return {
        ok: false,
        mensaje: tipo.extension === "pdf"
          ? "El archivo no parece ser un PDF válido."
          : "El archivo no parece ser un DOCX válido.",
      };
    }

    const storagePath = `dictamenes/${dictamen}/${randomUUID()}.${tipo.extension}`;
    const admin = servidor();
    const { error: eSubida } = await admin.storage.from(BUCKET_PRIVADO).upload(
      storagePath,
      contenidoAdjunto,
      { contentType: tipo.mime, cacheControl: "0", upsert: false },
    );
    if (eSubida) {
      return { ok: false, mensaje: `No se pudo guardar la plantilla: ${eSubida.message}` };
    }

    const { data: guardado, error: eRegistro } = await sb
      .from("dictamen_archivos")
      .upsert(
        {
          dictamen_id: dictamen,
          storage_path: storagePath,
          nombre_original: archivoFormulario.name || `plantilla-doble-ciego.${tipo.extension}`,
          mime: tipo.mime,
          bytes: archivoFormulario.size,
          guardado_at: new Date().toISOString(),
        },
        { onConflict: "dictamen_id" },
      )
      .select("dictamen_id, storage_path, nombre_original, mime, bytes, guardado_at")
      .maybeSingle();

    if (eRegistro || !guardado) {
      await admin.storage.from(BUCKET_PRIVADO).remove([storagePath]);
      return { ok: false, mensaje: eRegistro?.message ?? "No se pudo registrar la plantilla." };
    }

    if (archivoExistente && archivoExistente.storage_path !== guardado.storage_path) {
      await admin.storage.from(BUCKET_PRIVADO).remove([archivoExistente.storage_path]);
    }

    archivoGuardado = guardado;
    revalidatePath(`/panel/dictamen/${dictamen}`);
  }

  if (!archivoGuardado) {
    return { ok: false, mensaje: "Adjunta la plantilla de doble ciego antes de enviar el dictamen." };
  }

  if (!contenidoAdjunto) {
    const { data: blob, error: eDescarga } = await servidor()
      .storage
      .from(BUCKET_PRIVADO)
      .download(archivoGuardado.storage_path);

    if (eDescarga || !blob) {
      return { ok: false, mensaje: "No se pudo recuperar la plantilla guardada para adjuntarla al correo." };
    }
    contenidoAdjunto = Buffer.from(await blob.arrayBuffer());
  }

  // La instantánea la calcula el servidor y se guarda tal cual. La base exige
  // tanto la tarjeta completa como el archivo de doble ciego antes de permitir
  // la transición irreversible a enviado.
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

  const aviso = await enviarDictamen({
    a: "marco.mendez@tec.mx",
    nombreDictaminador: quien.nombre,
    nombrePieza: pieza.titulo,
    puntaje: `${veredicto.puntaje}/${veredicto.maximo}`,
    adjunto: {
      nombre: archivoGuardado.nombre_original,
      contenidoBase64: contenidoAdjunto.toString("base64"),
    },
  });

  if (!aviso.enviado) {
    await sb.from("envio_eventos").insert({
      envio_id: cabecera.envio_id,
      actor_id: quien.id,
      tipo: "aviso_dictamen_no_enviado",
      payload: { motivo: aviso.motivo ?? "desconocido" },
    });
  }

  revalidatePath(`/panel/dictamen/${dictamen}`);
  revalidatePath(`/panel/envios/${cabecera.envio_id}`);

  return aviso.enviado
    ? { ok: true, mensaje: `Dictamen enviado: ${veredicto.decision.etiqueta}` }
    : {
        ok: true,
        mensaje: `Dictamen enviado: ${veredicto.decision.etiqueta}. El correo a marco.mendez@tec.mx no salió; quedó registrado en la bitácora.`,
      };
}
