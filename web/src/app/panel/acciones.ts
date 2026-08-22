"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { sesion, personal } from "@/lib/supabase/sesion";
import { servidor, BUCKET_PRIVADO } from "@/lib/supabase/servidor";
import { enviarDecision } from "@/lib/correo/decision";

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
 * las funciones de 20260821140000_panel.sql, porque el UPDATE y su fila en
 * envio_eventos tienen que ir en la misma transacción. Un desvelado sin
 * registro vuelve falsa la afirmación de §7.
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
  const decision = Number(datos.get("decision") ?? 0);
  if (!envio || !decision) return { ok: false, mensaje: "Elige una decisión." };

  const sb = await sesion();
  const { error } = await sb.rpc("registrar_decision", { p_envio: envio, p_decision: decision });
  if (error) return { ok: false, mensaje: error.message };

  // Sólo AHORA se puede leer la autoría: grabar la decisión es el segundo
  // disparador de desvelado de §7.2, y RLS se evalúa por sentencia, así que
  // esta consulta pasa el predicado que la anterior no habría pasado. Si la
  // ceguera se rompiera, esto devolvería null y el autor no recibiría aviso —
  // se notaría, que es como debe fallar.
  const [pieza, autoria, etiqueta] = await Promise.all([
    sb.from("envios").select("folio, titulo, locale").eq("id", envio).maybeSingle(),
    sb.from("envios_autoria").select("nombre, correo").eq("envio_id", envio).maybeSingle(),
    sb.from("decisiones").select("etiqueta").eq("id", decision).maybeSingle(),
  ]);

  if (pieza.data && autoria.data && etiqueta.data) {
    const aviso = await enviarDecision({
      a: autoria.data.correo,
      nombre: autoria.data.nombre,
      folio: pieza.data.folio,
      titulo: pieza.data.titulo,
      decision: etiqueta.data.etiqueta,
      locale: pieza.data.locale,
    });

    // Igual que con el acuse: un correo que no sale no invalida la decisión,
    // pero tiene que quedar anotado o nadie se entera de que el autor no supo.
    if (!aviso.enviado) {
      await sb.from("envio_eventos").insert({
        envio_id: envio,
        actor_id: quien.id,
        tipo: "aviso_decision_no_enviado",
        payload: { motivo: aviso.motivo ?? "desconocido" },
      });
    }
  }

  revalidatePath(`/panel/envios/${envio}`);
  revalidatePath("/panel");
  return { ok: true, mensaje: "Decisión registrada y avisada al autor." };
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
