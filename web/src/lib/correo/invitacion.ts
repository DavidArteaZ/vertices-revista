import "server-only";
import { mandar, type Envio } from "./enviar";

/**
 * La invitación al comité, mandada por la revista y no por Supabase.
 *
 * Supabase sabe invitar solo, pero su correo pasa por /auth/v1/verify, que
 * devuelve la sesión en el fragmento de la URL —`#access_token=…`— y el
 * fragmento no viaja al servidor: la persona aterriza en la pantalla de entrar
 * a teclear una contraseña que todavía no tiene. Cambiarlo exige editar las
 * plantillas del panel de Supabase, que están detrás de configurar un SMTP
 * propio.
 *
 * Mandarla desde aquí evita las dos cosas: el enlace lleva el `token_hash` en
 * la query, que sí llega al servidor, y el correo sale por el mismo Resend que
 * ya usan el acuse y el aviso de decisión — un solo proveedor, un solo dominio
 * verificado, una sola cosa que vigilar.
 *
 * Va en español y sin `t`: el panel es interno y monolingüe, a diferencia de
 * los correos al autor, que van en el idioma con el que envió.
 */

export type Invitacion = {
  a: string;
  nombre: string;
  /** Quién invita, para que el correo no llegue de un desconocido. */
  invita: string;
  /** El enlace ya armado, con token_hash. De un solo uso. */
  enlace: string;
};

export function enviarInvitacion(i: Invitacion): Promise<Envio> {
  return mandar(i.a, "es", () => ({
    asunto: "Tu acceso al comité editorial de Vértices",
    lineas: [
      `Hola ${i.nombre}:`,
      "",
      `${i.invita} te dio de alta en el comité editorial de la Revista Vértices.`,
      "",
      "Entra con este enlace y elige tu contraseña:",
      i.enlace,
      "",
      "Es de un solo uso y caduca. Si expira, pide que te vuelvan a invitar.",
      "",
      "— Revista Vértices",
      "No respondas a este correo.",
    ],
  }));
}
