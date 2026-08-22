"use server";

import { revalidatePath } from "next/cache";
import { sesion, personal } from "@/lib/supabase/sesion";
import { servidor, BUCKET_PRIVADO, BUCKET_PUBLICO } from "@/lib/supabase/servidor";
import type { Resultado } from "../acciones";

/**
 * Armar y publicar un número (spec §9).
 *
 * El paso que no puede vivir en SQL es la copia del PDF del bucket privado al
 * público: Storage no se toca desde Postgres. Por eso publicar es una acción y
 * no una sola función, y por eso el ORDEN importa —copiar primero, marcar la
 * edición como publicada después—. Si la copia falla a medias, la edición
 * sigue en borrador y no hay nada visible: la política de `articulos` mira el
 * estado de su edición, así que media copia no es medio número publicado.
 */

const NO_AUTORIZADO: Resultado = { ok: false, mensaje: "No tienes acceso al panel." };

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

  const { error } = await sb.rpc("adjuntar_articulo", {
    p_envio: envio,
    p_edicion: edicion,
    p_minutos: minutos || null,
    p_temas: temas,
  });

  if (error) return { ok: false, mensaje: error.message };

  revalidatePath(`/panel/ediciones/${edicion}`);
  return { ok: true, mensaje: "Pieza añadida al número." };
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
  const { error } = await sb.from("articulos").delete().eq("id", articulo);
  if (error) return { ok: false, mensaje: error.message };

  revalidatePath(`/panel/ediciones/${edicion}`);
  return { ok: true, mensaje: "Pieza retirada del número." };
}

/**
 * Publicar: copiar los PDF y encender el número.
 *
 * La copia usa la clave de servicio porque el bucket privado no tiene una sola
 * política y nadie más puede leerlo. Lo que sustituye a la política es la
 * comprobación de personal de arriba — y que sólo se copia lo que cuelga de una
 * edición, que a su vez sólo admite piezas con decisión aceptante.
 */
export async function publicar(datos: FormData): Promise<Resultado> {
  const quien = await personal();
  if (!quien) return NO_AUTORIZADO;

  const edicion = Number(datos.get("edicion") ?? 0);
  if (!edicion) return { ok: false, mensaje: "Falta el número." };

  const sb = await sesion();
  const admin = servidor();

  const { data: articulos, error: eLista } = await sb
    .from("articulos")
    .select("id, titulo, slug, envio_id, pdf_publico_path")
    .eq("edicion_id", edicion);

  if (eLista) return { ok: false, mensaje: eLista.message };
  if (!articulos?.length) return { ok: false, mensaje: "Este número no tiene piezas." };

  for (const articulo of articulos) {
    if (articulo.pdf_publico_path || !articulo.envio_id) continue;

    const { data: archivo } = await sb
      .from("envio_archivos")
      .select("storage_path, mime")
      .eq("envio_id", articulo.envio_id)
      .eq("es_principal", true)
      .maybeSingle();

    if (!archivo) {
      return { ok: false, mensaje: `«${articulo.titulo}» no tiene manuscrito principal.` };
    }

    // Sólo se publica PDF. Un .docx en el bucket público sería un documento
    // editable con la maquetación del autor, no la pieza de la revista.
    if (archivo.mime !== "application/pdf") {
      return {
        ok: false,
        mensaje: `«${articulo.titulo}» se envió como Word. Sube el PDF maquetado antes de publicar.`,
      };
    }

    const { data: blob, error: eDescarga } = await admin.storage
      .from(BUCKET_PRIVADO)
      .download(archivo.storage_path);

    if (eDescarga || !blob) {
      return { ok: false, mensaje: `No se pudo leer el PDF de «${articulo.titulo}».` };
    }

    // La ruta pública es legible a propósito: es una URL que la gente comparte.
    // Nada de lo que hay aquí es privado — la pieza ya está publicada.
    const destino = `${edicion}/${articulo.slug}.pdf`;
    const { error: eSubida } = await admin.storage
      .from(BUCKET_PUBLICO)
      .upload(destino, await blob.arrayBuffer(), {
        contentType: "application/pdf",
        upsert: true,
      });

    if (eSubida) {
      return { ok: false, mensaje: `No se pudo publicar el PDF de «${articulo.titulo}».` };
    }

    const { error: eRuta } = await sb
      .from("articulos")
      .update({ pdf_publico_path: destino })
      .eq("id", articulo.id);

    if (eRuta) return { ok: false, mensaje: eRuta.message };
  }

  // Y ahora, con todos los PDF ya copiados, el número entero se enciende de
  // golpe. publicar_edicion se niega si queda alguno sin copiar.
  const { data: piezas, error } = await sb.rpc("publicar_edicion", { p_edicion: edicion });
  if (error) return { ok: false, mensaje: error.message };

  revalidatePath(`/panel/ediciones/${edicion}`);
  revalidatePath("/panel/ediciones");
  return { ok: true, mensaje: `Número publicado con ${piezas} piezas.` };
}
