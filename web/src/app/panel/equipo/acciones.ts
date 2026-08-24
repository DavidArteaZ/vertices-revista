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

export async function invitar(datos: FormData): Promise<Resultado> {
  const quien = await personal();
  if (!quien) return NO_AUTORIZADO;

  const nombre = String(datos.get("nombre") ?? "").trim();
  const correo = String(datos.get("correo") ?? "").trim().toLowerCase();

  if (!nombre) return { ok: false, mensaje: "Escribe el nombre." };
  if (!CORREO.test(correo)) return { ok: false, mensaje: "Ese correo no parece válido." };

  const admin = servidor();
  const origen = (await headers()).get("origin") ?? "";

  // El enlace se genera aquí y el correo lo manda la revista por Resend, en vez
  // de dejárselo a inviteUserByEmail. Ver src/lib/correo/invitacion.ts: el
  // correo de Supabase entrega la sesión en el fragmento de la URL y quien lo
  // abre acaba en la pantalla de entrar sin contraseña que teclear.
  const destino = { redirectTo: `${origen}/panel/clave` };

  let { data, error } = await admin.auth.admin.generateLink({
    type: "invite",
    email: correo,
    options: destino,
  });

  // `invite` se niega si la cuenta ya existe, y volver a invitar es justo lo
  // que dice la pantalla que se haga cuando el enlace caduca. Para ésas sirve
  // el de recuperación: el mismo aterrizaje, la misma elección de contraseña.
  if (error) {
    ({ data, error } = await admin.auth.admin.generateLink({
      type: "recovery",
      email: correo,
      options: destino,
    }));
  }

  if (error || !data.user) {
    return { ok: false, mensaje: error?.message ?? "No se pudo invitar." };
  }

  const tipo = data.properties.verification_type === "recovery" ? "recovery" : "invite";

  // La fila en `usuarios` es lo que da acceso, no la cuenta de Auth: es lo que
  // mira privado.es_staff(). Una cuenta sin fila aquí puede iniciar sesión y
  // no ve absolutamente nada.
  const { error: eFila } = await admin
    .from("usuarios")
    .upsert({ id: data.user.id, nombre, email: correo, activo: true });

  if (eFila) return { ok: false, mensaje: eFila.message };

  revalidatePath("/panel/equipo");

  // El alta ya está hecha; el correo es lo que puede fallar. Decirlo es lo que
  // permite reaccionar — quien invita puede pasar el enlace por otro lado en
  // vez de esperar a que llegue algo que nunca salió.
  const enlace =
    `${origen}/panel/auth/callback?token_hash=${data.properties.hashed_token}` +
    `&type=${tipo}&siguiente=/panel/clave`;

  const correoEnviado = await enviarInvitacion({
    a: correo,
    nombre,
    invita: quien.nombre,
    enlace,
  });

  return correoEnviado.enviado
    ? { ok: true, mensaje: `Invitación enviada a ${correo}.` }
    : {
        ok: true,
        mensaje:
          `${nombre} ya está en el comité, pero el correo no salió ` +
          `(${correoEnviado.motivo}). Pásale este enlace: ${enlace}`,
      };
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

  return { ok: true, mensaje: "Contraseña fijada. Ya puedes entrar al panel." };
}
