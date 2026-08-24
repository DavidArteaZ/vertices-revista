"use server";

import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { sesion, personal } from "@/lib/supabase/sesion";
import { servidor } from "@/lib/supabase/servidor";
import { CORREO } from "@/lib/validacion";
import { enviarInvitacion } from "@/lib/correo/invitacion";
import type { Resultado } from "../acciones";

/**
 * Altas y bajas del comité (spec §13: cuentas por invitación, sin alta
 * pública).
 *
 * Aquí sí hace falta la clave de servicio: crear una cuenta y mandar la
 * invitación son operaciones de la API de administración de Supabase Auth, y
 * no hay forma de hacerlas con la sesión de nadie. Lo que sustituye a la
 * política es la comprobación de que quien invita ya es del comité — y por eso
 * está lo primero de todo, antes incluso de leer el formulario.
 */

const NO_AUTORIZADO: Resultado = { ok: false, mensaje: "No tienes acceso al panel." };

/**
 * El enlace de un solo uso, generado por el lado administrador.
 *
 * `invite` se niega si la cuenta ya existe, y reenviar es justo lo que se pide
 * cuando el enlace caduca. Para ésas sirve el de recuperación: el mismo
 * aterrizaje, la misma elección de contraseña.
 *
 * Aterriza en /panel/invitacion y no en /panel/auth/callback a propósito. El
 * callback canjeaba el token en el GET, y los escáneres de enlaces del correo
 * institucional —Safe Links y los antivirus de la facultad— hacen ese GET antes
 * que la persona: el token es de un solo uso, así que llegaban a un enlace ya
 * gastado. La página puente no canjea nada hasta que alguien pulsa el botón.
 */
async function generarEnlace(correo: string, origen: string) {
  const admin = servidor();
  const destino = { redirectTo: `${origen}/panel/clave` };

  let { data, error } = await admin.auth.admin.generateLink({
    type: "invite",
    email: correo,
    options: destino,
  });

  if (error) {
    ({ data, error } = await admin.auth.admin.generateLink({
      type: "recovery",
      email: correo,
      options: destino,
    }));
  }

  if (error || !data.user) return { error: error?.message ?? "No se pudo generar el enlace." };

  const tipo = data.properties.verification_type === "recovery" ? "recovery" : "invite";

  return {
    usuarioId: data.user.id,
    enlace:
      `${origen}/panel/invitacion?token_hash=${data.properties.hashed_token}` +
      `&type=${tipo}&siguiente=/panel/clave`,
  };
}

/**
 * Mandar el correo y dejar constancia de que salió.
 *
 * El alta ya está hecha cuando se llega aquí; el correo es lo que puede fallar.
 * Decirlo es lo que permite reaccionar — quien invita puede pasar el enlace por
 * otro lado en vez de esperar a que llegue algo que nunca salió.
 *
 * `invitacion_email_id` es lo que después casa un rebote con esta persona sin
 * guardar su dirección en ninguna bitácora: ver /api/webhooks/resend.
 */
async function mandarYRegistrar(
  usuarioId: string,
  nombre: string,
  correo: string,
  invita: string,
  enlace: string,
): Promise<Resultado> {
  const enviado = await enviarInvitacion({ a: correo, nombre, invita, enlace });

  await servidor()
    .from("usuarios")
    .update({
      invitada_en: new Date().toISOString(),
      invitacion_email_id: enviado.id ?? null,
      invitacion_estado: enviado.enviado ? "enviado" : "fallido",
    })
    .eq("id", usuarioId);

  revalidatePath("/panel/equipo");

  return enviado.enviado
    ? { ok: true, mensaje: `Invitación enviada a ${correo}.` }
    : {
        ok: true,
        mensaje:
          `${nombre} ya está en el comité, pero el correo no salió ` +
          `(${enviado.motivo}). Pásale este enlace: ${enlace}`,
      };
}

export async function invitar(datos: FormData): Promise<Resultado> {
  const quien = await personal();
  if (!quien) return NO_AUTORIZADO;

  const nombre = String(datos.get("nombre") ?? "").trim();
  const correo = String(datos.get("correo") ?? "").trim().toLowerCase();

  if (!nombre) return { ok: false, mensaje: "Escribe el nombre." };
  if (!CORREO.test(correo)) return { ok: false, mensaje: "Ese correo no parece válido." };

  const origen = (await headers()).get("origin") ?? "";
  const enlace = await generarEnlace(correo, origen);
  if ("error" in enlace) return { ok: false, mensaje: enlace.error };

  // La fila en `usuarios` es lo que da acceso, no la cuenta de Auth: es lo que
  // mira privado.es_staff(). Una cuenta sin fila aquí puede iniciar sesión y
  // no ve absolutamente nada.
  const { error: eFila } = await servidor()
    .from("usuarios")
    .upsert({ id: enlace.usuarioId, nombre, email: correo, activo: true });

  if (eFila) return { ok: false, mensaje: eFila.message };

  return mandarYRegistrar(enlace.usuarioId, nombre, correo, quien.nombre, enlace.enlace);
}

/**
 * Reenviar el enlace a alguien que ya está dado de alta.
 *
 * Separada de `invitar` y no un atajo suyo: `invitar` hace un upsert con
 * `activo: true`, así que reenviar por esa vía reactivaría en silencio a quien
 * está de baja. Aquí no se toca `activo` ni se sobrescribe el nombre.
 */
export async function reinvitar(datos: FormData): Promise<Resultado> {
  const quien = await personal();
  if (!quien) return NO_AUTORIZADO;

  const id = String(datos.get("usuario") ?? "");
  const admin = servidor();

  const { data: persona } = await admin
    .from("usuarios")
    .select("id, nombre, email, activo")
    .eq("id", id)
    .maybeSingle();

  if (!persona) return { ok: false, mensaje: "No encuentro a esa persona." };
  if (!persona.activo) {
    return { ok: false, mensaje: "Está de baja. Reactívala antes de reinvitar." };
  }

  const origen = (await headers()).get("origin") ?? "";
  const enlace = await generarEnlace(persona.email, origen);
  if ("error" in enlace) return { ok: false, mensaje: enlace.error };

  return mandarYRegistrar(persona.id, persona.nombre, persona.email, quien.nombre, enlace.enlace);
}

/**
 * Dar de baja es `activo = false`, nunca borrar.
 *
 * Borrar la fila arrastraría en cascada sus asignaciones y sus dictámenes, y
 * con ellos la instantánea de lo que el comité vio el día que dictaminó. Quien
 * se va deja de entrar; lo que dictaminó se queda.
 */
export async function cambiarActivo(datos: FormData): Promise<Resultado> {
  const quien = await personal();
  if (!quien) return NO_AUTORIZADO;

  const id = String(datos.get("usuario") ?? "");
  const activo = datos.get("activo") === "si";

  if (id === quien.id && !activo) {
    return { ok: false, mensaje: "No puedes darte de baja a ti misma desde aquí." };
  }

  const sb = await sesion();
  // usuarios no tiene política de UPDATE para authenticated: la baja la hace
  // el service_role tras comprobar arriba que quien la pide es del comité.
  void sb;
  const { error } = await servidor().from("usuarios").update({ activo }).eq("id", id);
  if (error) return { ok: false, mensaje: error.message };

  revalidatePath("/panel/equipo");
  return { ok: true, mensaje: activo ? "Reactivada." : "Dada de baja." };
}

/** Fijar la contraseña al aceptar la invitación. */
export async function fijarClave(_previo: Resultado | null, datos: FormData): Promise<Resultado> {
  const clave = String(datos.get("clave") ?? "");
  const repetida = String(datos.get("repetida") ?? "");

  if (clave.length < 12) {
    return { ok: false, mensaje: "Usa al menos 12 caracteres." };
  }
  if (clave !== repetida) return { ok: false, mensaje: "Las dos contraseñas no coinciden." };

  const sb = await sesion();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return { ok: false, mensaje: "El enlace de invitación caducó. Pide otro." };

  const { error } = await sb.auth.updateUser({ password: clave });
  if (error) return { ok: false, mensaje: error.message };

  // Lo que convierte «invitada» en «activa» en la pantalla del comité. Va por
  // service_role porque `usuarios` no tiene grant de UPDATE para authenticated,
  // y va después del updateUser: si la contraseña no se guardó, esto tampoco.
  await servidor()
    .from("usuarios")
    .update({ clave_fijada_en: new Date().toISOString() })
    .eq("id", user.id);

  revalidatePath("/panel/equipo");
  return { ok: true, mensaje: "Contraseña fijada. Ya puedes entrar al panel." };
}
