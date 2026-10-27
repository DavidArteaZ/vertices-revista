"use server";

import { revalidatePath } from "next/cache";
import { sesion, personal } from "@/lib/supabase/sesion";
import { servidor, BUCKET_PUBLICO } from "@/lib/supabase/servidor";
import type { Resultado } from "../acciones";
import { copiarManuscrito } from "./pdf";

/**
 * Armar y publicar un número (spec §9).
 *
 * El paso que no puede vivir en SQL es la copia del PDF del bucket privado al
 * público: Storage no se toca desde Postgres. Esa copia ocurre al convertir la
 * pieza en artículo (o al subir su PDF maquetado), no al publicar —ver
 * `./pdf.ts`—. Publicar sólo enciende el número, y publicar_edicion se niega
 * mientras quede una pieza sin PDF, así que no hay número a medias.
 */

const NO_AUTORIZADO: Resultado = { ok: false, mensaje: "No tienes acceso al panel." };
const FECHA = /^\d{4}-\d{2}-\d{2}$/;
const HORA = /^([01]\d|2[0-3]):[0-5]\d(:[0-5]\d)?$/;


export async function activarEdicion(edicion: number, activa: boolean): Promise<Resultado> {
  if (!(await personal())) return NO_AUTORIZADO;
  if (!edicion) return { ok: false, mensaje: "Falta la edición." };

  const sb = await sesion();

  if (activa) {
    const { error: eApagar } = await sb.from("ediciones").update({ activa: false }).neq("id", edicion);
    if (eApagar) return { ok: false, mensaje: eApagar.message };
  }

  const { error } = await sb.from("ediciones").update({ activa }).eq("id", edicion);
  if (error) return { ok: false, mensaje: error.message };

  revalidatePath("/panel/ediciones");
  revalidatePath("/registro");
  return { ok: true, mensaje: activa ? "Edición activa actualizada." : "Edición desactivada." };
}

export async function crearEdicion(datos: FormData): Promise<Resultado> {
  if (!(await personal())) return NO_AUTORIZADO;

  const numero = Number(datos.get("numero") ?? 0);
  const titulo = String(datos.get("titulo") ?? "").trim();
  if (!numero || !titulo) return { ok: false, mensaje: "Hacen falta número y título." };

  const sb = await sesion();
  const { error } = await sb.from("ediciones").insert({ numero, titulo });
  if (error) {
    return {
      ok: false,
      mensaje: error.code === "23505" ? `Ya existe el número ${numero}.` : error.message,
    };
  }

  revalidatePath("/panel/ediciones");
  return { ok: true, mensaje: `Número ${numero} creado.` };
}

export async function guardarParametros(datos: FormData): Promise<Resultado> {
  if (!(await personal())) return NO_AUTORIZADO;

  const edicion = Number(datos.get("edicion") ?? 0);
  const fechaLanzamiento = String(datos.get("fecha_lanzamiento") ?? "").trim();
  const ubicacion = String(datos.get("ubicacion_evento_lanzamiento") ?? "").trim();
  const fechaLimite = String(datos.get("fecha_limite_revisiones") ?? "").trim();
  const horaEvento = String(datos.get("hora_evento") ?? "").trim();

  if (!edicion) return { ok: false, mensaje: "Falta la edición." };
  if (fechaLanzamiento && !FECHA.test(fechaLanzamiento)) {
    return { ok: false, mensaje: "La fecha de lanzamiento no es válida." };
  }
  if (fechaLimite && !FECHA.test(fechaLimite)) {
    return { ok: false, mensaje: "La fecha límite de revisiones no es válida." };
  }
  if (horaEvento && !HORA.test(horaEvento)) {
    return { ok: false, mensaje: "La hora del evento no es válida." };
  }

  const sb = await sesion();
  const { error } = await sb
    .from("ediciones")
    .update({
      fecha_lanzamiento: fechaLanzamiento || null,
      ubicacion_evento_lanzamiento: ubicacion || null,
      fecha_limite_revisiones: fechaLimite || null,
      hora_evento: horaEvento || null,
    })
    .eq("id", edicion);

  if (error) {
    if (error.message.includes("hora_evento")) {
      return {
        ok: false,
        mensaje: "La base de Supabase todavía no tiene la columna de la hora del evento (migración hora_evento).",
      };
    }
    const esquemaDesactualizado =
      error.message.includes("schema cache") ||
      error.message.includes("fecha_lanzamiento") ||
      error.code === "PGRST204";
    return {
      ok: false,
      mensaje: esquemaDesactualizado
        ? "La base de Supabase no tiene aplicada la migración de dictaminaciones. Los parámetros de edición todavía no existen en el esquema."
        : error.message,
    };
  }

  revalidatePath(`/panel/ediciones/${edicion}`);
  revalidatePath("/panel/ediciones");
  return { ok: true, mensaje: "Parámetros guardados." };
}

export async function adjuntar(datos: FormData): Promise<Resultado> {
  if (!(await personal())) return NO_AUTORIZADO;

  const edicion = Number(datos.get("edicion") ?? 0);
  const envio = String(datos.get("envio") ?? "");
  const minutos = Number(datos.get("minutos") ?? 0);
  if (!edicion || !envio) return { ok: false, mensaje: "Elige una pieza." };

  const sb = await sesion();

  // Los temas del envío pasan al artículo: son los que el descubrimiento usa
  // para filtrar, y volver a teclearlos sería otra ocasión de que no coincidan.
  const { data: pieza } = await sb.from("envios").select("tema_id").eq("id", envio).maybeSingle();
  const temas = pieza?.tema_id ? [pieza.tema_id] : [];

  const { data: articulo, error } = await sb.rpc("adjuntar_articulo", {
    p_envio: envio,
    p_edicion: edicion,
    p_minutos: minutos || null,
    p_temas: temas,
  });

  if (error) return { ok: false, mensaje: error.message };

  revalidatePath(`/panel/ediciones/${edicion}`);

  // El artículo ya existe aunque la copia falle: su fila lo dice y ofrece subir
  // el PDF a mano, así que no hay nada que deshacer.
  const { data: fila } = await sb.from("articulos").select("id, slug, envio_id").eq("id", articulo).maybeSingle();
  const motivo = fila ? await copiarManuscrito(sb, fila, edicion) : "No se encontró el artículo recién creado.";

  if (motivo) {
    return {
      ok: true,
      mensaje: `Pieza convertida en artículo, pero aún sin PDF: ${motivo} Sube el PDF maquetado en su fila.`,
    };
  }
  return { ok: true, mensaje: "Pieza convertida en artículo. Su PDF ya tiene enlace." };
}

/**
 * Fijar el PDF maquetado que se acaba de subir desde la fila del artículo.
 *
 * La subida va directa del navegador a Storage con una URL firmada
 * (`/api/panel/articulos/[id]/pdf`), porque una Function de Vercel no acepta
 * cuerpos de más de 4.5 MB. Aquí sólo llega la ruta, y sólo se acepta si es la
 * que esa misma firma pudo haber dado a este artículo.
 */
export async function fijarPdf(datos: FormData): Promise<Resultado> {
  if (!(await personal())) return NO_AUTORIZADO;

  const articulo = Number(datos.get("articulo") ?? 0);
  const ruta = String(datos.get("ruta") ?? "");

  const sb = await sesion();
  const { data: fila } = await sb
    .from("articulos")
    .select("id, slug, edicion_id, pdf_publico_path")
    .eq("id", articulo)
    .maybeSingle();

  if (!fila?.edicion_id) return { ok: false, mensaje: "No se encontró el artículo." };
  if (!ruta.startsWith(`${fila.edicion_id}/${fila.slug}-`) || !ruta.endsWith(".pdf")) {
    return { ok: false, mensaje: "La ruta del PDF no corresponde a este artículo." };
  }

  const { error } = await sb.from("articulos").update({ pdf_publico_path: ruta }).eq("id", articulo);
  if (error) return { ok: false, mensaje: error.message };

  // El anterior deja de estar enlazado desde el sitio; borrarlo evita que siga
  // circulando una versión que el comité ya reemplazó.
  if (fila.pdf_publico_path && fila.pdf_publico_path !== ruta) {
    const { error: eBorrado } = await servidor().storage.from(BUCKET_PUBLICO).remove([fila.pdf_publico_path]);
    if (eBorrado) {
      console.error(JSON.stringify({ evento: "panel_pdf_viejo_fallo", articulo, error: eBorrado.message }));
    }
  }

  revalidatePath(`/panel/ediciones/${fila.edicion_id}`);
  return { ok: true, mensaje: "PDF actualizado." };
}

export async function ajustarArticulo(datos: FormData): Promise<Resultado> {
  if (!(await personal())) return NO_AUTORIZADO;

  const articulo = Number(datos.get("articulo") ?? 0);
  const edicion = Number(datos.get("edicion") ?? 0);
  const minutos = Number(datos.get("minutos") ?? 0);
  const destacado = datos.get("destacado") === "on";

  const sb = await sesion();
  const { error } = await sb
    .from("articulos")
    .update({ minutos_lectura: minutos || null, destacado })
    .eq("id", articulo);

  if (error) return { ok: false, mensaje: error.message };

  revalidatePath(`/panel/ediciones/${edicion}`);
  return { ok: true, mensaje: "Guardado." };
}

export async function quitarArticulo(datos: FormData): Promise<Resultado> {
  if (!(await personal())) return NO_AUTORIZADO;

  const articulo = Number(datos.get("articulo") ?? 0);
  const edicion = Number(datos.get("edicion") ?? 0);

  const sb = await sesion();
  const { data: fila } = await sb.from("articulos").select("pdf_publico_path").eq("id", articulo).maybeSingle();
  const { error } = await sb.from("articulos").delete().eq("id", articulo);
  if (error) return { ok: false, mensaje: error.message };

  // Su PDF ya estaba en el bucket público; sin artículo no debe quedarse ahí.
  if (fila?.pdf_publico_path) {
    const { error: eBorrado } = await servidor().storage.from(BUCKET_PUBLICO).remove([fila.pdf_publico_path]);
    if (eBorrado) {
      console.error(JSON.stringify({ evento: "panel_pdf_quitar_fallo", articulo, error: eBorrado.message }));
    }
  }

  revalidatePath(`/panel/ediciones/${edicion}`);
  return { ok: true, mensaje: "Pieza retirada del número." };
}

/**
 * Publicar: encender el número entero de una vez.
 *
 * Los PDF ya se copiaron al armar el número. Aquí sólo se comprueba que no
 * falte ninguno, para decir cuál con su título en vez del recuento genérico
 * con el que se negaría publicar_edicion.
 */
export async function publicar(datos: FormData): Promise<Resultado> {
  if (!(await personal())) return NO_AUTORIZADO;

  const edicion = Number(datos.get("edicion") ?? 0);
  if (!edicion) return { ok: false, mensaje: "Falta el número." };

  const sb = await sesion();

  const { data: articulos, error: eLista } = await sb
    .from("articulos")
    .select("titulo, pdf_publico_path")
    .eq("edicion_id", edicion);

  if (eLista) return { ok: false, mensaje: eLista.message };
  if (!articulos?.length) return { ok: false, mensaje: "Este número no tiene piezas." };

  const sinPdf = articulos.filter((a) => !a.pdf_publico_path).map((a) => `«${a.titulo}»`);
  if (sinPdf.length) {
    return { ok: false, mensaje: `Falta el PDF de ${sinPdf.join(", ")}. Súbelo en su fila antes de publicar.` };
  }

  const { data: piezas, error } = await sb.rpc("publicar_edicion", { p_edicion: edicion });
  if (error) return { ok: false, mensaje: error.message };

  revalidatePath(`/panel/ediciones/${edicion}`);
  revalidatePath("/panel/ediciones");
  return { ok: true, mensaje: `Número publicado con ${piezas} piezas.` };
}

/**
 * Borrar un registro de /registro desde el desglose de Invitados.
 *
 * Con la clave de servicio, como `publicar`: la tabla sólo tiene política de
 * lectura para el comité, y abrirle borrado con una migración costaría más
 * que la comprobación de personal de arriba, que es el mismo candado.
 */
export async function borrarRegistro(datos: FormData): Promise<Resultado> {
  if (!(await personal())) return NO_AUTORIZADO;

  const registro = Number(datos.get("registro") ?? 0);
  const edicion = Number(datos.get("edicion") ?? 0);
  if (!registro) return { ok: false, mensaje: "Falta el registro." };

  const { error } = await servidor().from("registros_evento").delete().eq("id", registro);
  if (error) {
    console.error(JSON.stringify({ evento: "panel_borrar_registro_fallo", registro, error: error.message }));
    return { ok: false, mensaje: "No se pudo eliminar el registro. Inténtalo de nuevo." };
  }

  revalidatePath(`/panel/ediciones/${edicion}`);
  return { ok: true, mensaje: "Registro eliminado." };
}
