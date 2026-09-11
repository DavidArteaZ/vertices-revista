"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { sesion, personal } from "@/lib/supabase/sesion";
import { servidor, BUCKET_PRIVADO } from "@/lib/supabase/servidor";
import { enviarDecision } from "@/lib/correo/decision";
import {
  esDecisionFinal,
  ordenDecisionFinal,
  requiereComentarios,
} from "@/lib/decisiones-finales";

/**
 * Las acciones del panel (spec §4.2).
 *
 * Todas corren como la sesión de quien las invoca, así que RLS sigue siendo lo
 * que decide. Cada una vuelve a comprobar que quien llama es del comité: una
 * acción de servidor es un endpoint, y que la página que la ofrece tenga
 * guardia no impide que alguien la invoque directamente.
 *
 * Las transiciones que desvelan algo —dictamen enviado, anonimización
 * revisada, decisión grabada, revisión vinculada— no se escriben aquí sino en
 * funciones de base, porque el UPDATE y su fila en envio_eventos tienen que ir
 * en la misma transacción. Un desvelado sin registro vuelve falsa la afirmación
 * de §7.
 */

export type Resultado = { ok: boolean; mensaje?: string };

const NO_AUTORIZADO: Resultado = { ok: false, mensaje: "No tienes acceso al panel." };

// ------------------------------------------------------------------- sesión

export async function entrar(_previo: Resultado | null, datos: FormData): Promise<Resultado> {
  const correo = String(datos.get("correo") ?? "").trim();
  const clave = String(datos.get("clave") ?? "");

  if (!correo || !clave) return { ok: false, mensaje: "Escribe tu correo y tu contraseña." };

  const sb = await sesion();
  const { error } = await sb.auth.signInWithPassword({ email: correo, password: clave });

  // Un mensaje único para "no existe" y para "contraseña incorrecta": el panel
  // no debe servir para averiguar quién está en el comité.
  if (error) return { ok: false, mensaje: "Correo o contraseña incorrectos." };

  // Cuenta de Supabase sin fila en usuarios, o dada de baja: la sesión existe
  // pero no da acceso, así que se cierra en vez de dejarla dando vueltas.
  const quien = await personal();
  if (!quien) {
    await sb.auth.signOut();
    return { ok: false, mensaje: "Esta cuenta no está activa en el comité." };
  }

  redirect("/panel");
}

export async function salir() {
  const sb = await sesion();
  await sb.auth.signOut();
  redirect("/panel/entrar");
}

// -------------------------------------------------------------------- triaje

export async function triar(datos: FormData): Promise<Resultado> {
  if (!(await personal())) return NO_AUTORIZADO;

  const envio = String(datos.get("envio") ?? "");
  const seccion = Number(datos.get("seccion") ?? 0);
  const tipo = Number(datos.get("tipo") ?? 0);
  const tema = Number(datos.get("tema") ?? 0);
  const extension = String(datos.get("extension") ?? "").trim();

  if (!envio || !seccion) return { ok: false, mensaje: "Elige una sección." };

  // Sólo se escriben sección, tipo y tema. El nivel y el instrumento de
  // dictamen los deriva el disparador envios_deriva_enrutamiento, para que la
  // regla del libro tenga una sola implementación y el triaje no pueda
  // enrutar una pieza a mano al instrumento equivocado.
  const sb = await sesion();
  const { error } = await sb
    .from("envios")
    .update({
      seccion_id: seccion,
      tipo_pieza_id: tipo || null,
      tema_id: tema || null,
      extension: extension || null,
      estado: "triage",
    })
    .eq("id", envio);

  if (error) return { ok: false, mensaje: error.message };

  revalidatePath(`/panel/envios/${envio}`);
  revalidatePath("/panel");
  return { ok: true, mensaje: "Triaje guardado." };
}

// -------------------------------------------------------------- asignaciones

export async function asignar(datos: FormData): Promise<Resultado> {
  const quien = await personal();
  if (!quien) return NO_AUTORIZADO;

  const envio = String(datos.get("envio") ?? "");
  const revisor = String(datos.get("revisor") ?? "");
  if (!envio || !revisor) return { ok: false, mensaje: "Elige a quién asignar." };

  const sb = await sesion();
  const { error } = await sb
    .from("asignaciones")
    .insert({ envio_id: envio, revisor_id: revisor, asignado_por: quien.id });

  if (error) return { ok: false, mensaje: error.message };

  await sb.from("envios").update({ estado: "asignado" }).eq("id", envio).eq("estado", "triage");
  await sb.from("envio_eventos").insert({
    envio_id: envio,
    actor_id: quien.id,
    tipo: "asignacion_creada",
    payload: { revisor },
  });

  revalidatePath(`/panel/envios/${envio}`);
  return { ok: true, mensaje: "Asignación creada." };
}

export async function desasignar(datos: FormData): Promise<Resultado> {
  const quien = await personal();
  if (!quien) return NO_AUTORIZADO;

  const envio = String(datos.get("envio") ?? "");
  const revisor = String(datos.get("revisor") ?? "");

  const sb = await sesion();
  // Con un dictamen enviado detrás, la llave compuesta lo impide y está bien
  // que lo impida: borrar la asignación borraría el dictamen en cascada.
  const { error } = await sb
    .from("asignaciones")
    .delete()
    .eq("envio_id", envio)
    .eq("revisor_id", revisor);

  if (error) {
    return { ok: false, mensaje: "No se puede quitar: ya hay un dictamen de esa persona." };
  }

  revalidatePath(`/panel/envios/${envio}`);
  return { ok: true, mensaje: "Asignación retirada." };
}

// -------------------------------------------------------------- dictámenes

/**
 * Abre —o retoma— la tarjeta de quien llama para este envío, y lleva a ella.
 *
 * El INSERT lo permite la llave compuesta sólo si existe la asignación: sin
 * ella, cualquiera del comité podría abrir una tarjeta de cualquier pieza con
 * el único fin de desvelarse a sí misma la autoría al enviarla.
 *
 * La versión de rúbrica se fija AQUÍ y no se recalcula después: si el comité
 * publica una revisión del instrumento a mitad del dictamen, esta tarjeta
 * sigue siendo la que se empezó.
 */
export async function abrirDictamen(datos: FormData): Promise<Resultado> {
  const quien = await personal();
  if (!quien) return NO_AUTORIZADO;

  const envio = String(datos.get("envio") ?? "");
  const sb = await sesion();

  const { data: existente } = await sb
    .from("dictamenes")
    .select("id")
    .eq("envio_id", envio)
    .eq("revisor_id", quien.id)
    .maybeSingle();

  if (existente) redirect(`/panel/dictamen/${existente.id}`);

  const { data: pieza } = await sb
    .from("envios")
    .select("seccion_dictamen_id")
    .eq("id", envio)
    .maybeSingle();

  if (!pieza?.seccion_dictamen_id) {
    return { ok: false, mensaje: "Esta pieza aún no tiene instrumento: falta triaje." };
  }

  const { data: rubrica } = await sb
    .from("rubrica_versiones")
    .select("id")
    .eq("seccion_id", pieza.seccion_dictamen_id)
    .eq("vigente", true)
    .maybeSingle();

  if (!rubrica) return { ok: false, mensaje: "No hay rúbrica vigente para esa sección." };

  const { data: creado, error } = await sb
    .from("dictamenes")
    .insert({ envio_id: envio, revisor_id: quien.id, rubrica_version_id: rubrica.id })
    .select("id")
    .maybeSingle();

  if (error || !creado) {
    return { ok: false, mensaje: "No puedes dictaminar esta pieza: no estás asignada." };
  }

  redirect(`/panel/dictamen/${creado.id}`);
}

// ------------------------------------------------------------ anonimización

export async function marcarAnonimizacion(datos: FormData): Promise<Resultado> {
  if (!(await personal())) return NO_AUTORIZADO;

  const envio = String(datos.get("envio") ?? "");
  const antiplagio = String(datos.get("antiplagio") ?? "").trim();

  const sb = await sesion();
  const { error } = await sb.rpc("marcar_anonimizacion", {
    p_envio: envio,
    p_antiplagio: antiplagio || null,
  });

  if (error) return { ok: false, mensaje: error.message };

  revalidatePath(`/panel/envios/${envio}`);
  return { ok: true, mensaje: "Anonimización revisada." };
}

// ------------------------------------------------------------------ decisión

export async function registrarDecision(datos: FormData): Promise<Resultado> {
  const quien = await personal();
  if (!quien) return NO_AUTORIZADO;

  const envio = String(datos.get("envio") ?? "");
  const decisionFinal = String(datos.get("decision") ?? "");
  const comentarios = String(datos.get("comentarios") ?? "").trim();
  const confirmacionNombre = String(datos.get("confirmacion_nombre") ?? "").trim();
  const edicionId = Number(datos.get("edicion") ?? 0);

  if (!envio || !esDecisionFinal(decisionFinal)) {
    return { ok: false, mensaje: "Elige una decisión válida." };
  }
  if (requiereComentarios(decisionFinal) && !comentarios) {
    return { ok: false, mensaje: "Escribe las revisiones o comentarios antes de continuar." };
  }
  if (!edicionId) return { ok: false, mensaje: "Elige una edición para completar el correo." };
  if (!confirmacionNombre) return { ok: false, mensaje: "Escribe tu nombre para confirmar la decisión." };

  const sb = await sesion();
  const { data: pieza } = await sb
    .from("envios")
    .select("seccion_dictamen_id, locale")
    .eq("id", envio)
    .maybeSingle();

  if (!pieza?.seccion_dictamen_id) {
    return { ok: false, mensaje: "Esta pieza todavía no tiene instrumento de dictamen." };
  }

  const { data: rubrica } = await sb
    .from("rubrica_versiones")
    .select("id")
    .eq("seccion_id", pieza.seccion_dictamen_id)
    .eq("vigente", true)
    .maybeSingle();

  if (!rubrica) return { ok: false, mensaje: "No hay rúbrica vigente para esta pieza." };

  // decision_id sigue apuntando a la fila equivalente del instrumento para no
  // cambiar el motor de rúbricas, la ceguera ni la regla que habilita artículos.
  const { data: decisionTecnica } = await sb
    .from("decisiones")
    .select("id")
    .eq("rubrica_version_id", rubrica.id)
    .eq("orden", ordenDecisionFinal(decisionFinal))
    .eq("es_falla", false)
    .maybeSingle();

  if (!decisionTecnica) {
    return { ok: false, mensaje: "No se encontró la equivalencia de esta decisión en la rúbrica." };
  }

  const { data: edicion } = await sb
    .from("ediciones")
    .select("id, numero, fecha_lanzamiento, ubicacion_evento_lanzamiento, fecha_limite_revisiones")
    .eq("id", edicionId)
    .maybeSingle();

  if (!edicion) return { ok: false, mensaje: "La edición seleccionada ya no existe." };

  const { error } = await sb.rpc("registrar_decision", {
    p_envio: envio,
    p_decision: decisionTecnica.id,
    p_decision_final: decisionFinal,
    p_nombre_confirmacion: confirmacionNombre,
    p_comentarios: comentarios || null,
    p_edicion: edicionId,
  });
  if (error) return { ok: false, mensaje: error.message };

  // La autoría se consulta después de la decisión. decision_id sigue siendo el
  // disparador de desvelado usado por las políticas existentes.
  const { data: autoria } = await sb
    .from("envios_autoria")
    .select("nombre, correo, genero")
    .eq("envio_id", envio)
    .maybeSingle();

  let avisado = false;
  let motivo = "faltan datos de autoría después de registrar la decisión";

  if (autoria) {
    const aviso = await enviarDecision({
      a: autoria.correo,
      nombre: autoria.nombre,
      genero: autoria.genero ?? "",
      decision: decisionFinal,
      comentarios,
      locale: pieza.locale,
      edicion: {
        numero: edicion.numero,
        fecha_lanzamiento: edicion.fecha_lanzamiento,
        ubicacion_evento_lanzamiento: edicion.ubicacion_evento_lanzamiento,
        fecha_limite_revisiones: edicion.fecha_limite_revisiones,
      },
    });
    avisado = aviso.enviado;
    motivo = aviso.motivo ?? "desconocido";
  }

  if (!avisado) {
    await sb.from("envio_eventos").insert({
      envio_id: envio,
      actor_id: quien.id,
      tipo: "aviso_decision_no_enviado",
      payload: { motivo },
    });
  }

  revalidatePath(`/panel/envios/${envio}`);
  revalidatePath("/panel");
  revalidatePath("/panel/ediciones");

  return avisado
    ? { ok: true, mensaje: "Decisión registrada y avisada al autor." }
    : {
        ok: true,
        mensaje: "Decisión registrada, pero el aviso al autor NO salió. Queda en la bitácora; avísale por otra vía.",
      };
}

// ------------------------------------------------------------------- borrado

export async function borrarEnvio(datos: FormData): Promise<Resultado> {
  if (!(await personal())) return NO_AUTORIZADO;

  const envio = String(datos.get("envio") ?? "");
  if (!envio) return { ok: false, mensaje: "Falta el envío." };

  const sb = await sesion();
  const { error } = await sb.rpc("borrar_envio_sin_decision", { p_envio: envio });
  if (error) return { ok: false, mensaje: error.message };

  revalidatePath("/panel");
  return { ok: true, mensaje: "Envío eliminado de la base." };
}

// ---------------------------------------------------------------- revisiones

export async function vincularRevision(datos: FormData): Promise<Resultado> {
  if (!(await personal())) return NO_AUTORIZADO;

  const envio = String(datos.get("envio") ?? "");
  const folioOriginal = String(datos.get("original") ?? "").trim().toUpperCase();
  if (!folioOriginal) return { ok: false, mensaje: "Escribe el folio del envío original." };

  const sb = await sesion();
  const { data: original } = await sb
    .from("envios")
    .select("id")
    .eq("folio", folioOriginal)
    .maybeSingle();

  if (!original) return { ok: false, mensaje: `No existe el folio ${folioOriginal}.` };

  const { error } = await sb.rpc("vincular_revision", {
    p_envio: envio,
    p_original: original.id,
  });
  if (error) return { ok: false, mensaje: error.message };

  revalidatePath(`/panel/envios/${envio}`);
  return { ok: true, mensaje: `Vinculado con ${folioOriginal}.` };
}

// ------------------------------------------------------------------ archivos

/**
 * URL de descarga firmada, de vida corta.
 *
 * Éste es el único sitio del panel que usa la clave de servicio, y es por una
 * razón concreta: storage.objects tiene RLS activo y ni una política, de modo
 * que la sesión de una persona del comité no puede firmar nada —ni leer el
 * objeto—. Firmar exige saltarse RLS.
 *
 * Lo que sustituye a la política es la comprobación de arriba. Y no rompe la
 * ceguera: §7.2 dice expresamente que el archivo del manuscrito se ve estando
 * ciego; lo que se oculta es su nombre original, que vive en
 * envio_archivo_nombres y sí está tras el predicado.
 */
export async function abrirArchivo(datos: FormData): Promise<Resultado> {
  if (!(await personal())) return NO_AUTORIZADO;

  const path = String(datos.get("path") ?? "");
  const { data } = await servidor().storage.from(BUCKET_PRIVADO).createSignedUrl(path, 300);
  if (!data?.signedUrl) return { ok: false, mensaje: "No se pudo abrir el archivo." };

  // Redirigir en vez de devolver la URL: así la URL firmada no pasa por el
  // navegador como dato ni acaba en el HTML de la página.
  redirect(data.signedUrl);
}
