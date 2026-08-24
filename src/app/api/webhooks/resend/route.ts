import { servidor } from "@/lib/supabase/servidor";
import { verificaSvix } from "@/lib/api/svix";
import { estadoDeEvento } from "@/lib/invitaciones";
import { bitacora, json } from "@/lib/api/peticion";

/**
 * Webhooks de Resend: entrega y rebote (spec §15).
 *
 * Existe por el defecto que motivó la reescritura. Un envío puede guardarse
 * bien y el acuse no llegar nunca —dirección mal escrita, buzón lleno, dominio
 * inexistente— y hoy nadie se enteraría: el autor se queda esperando y el
 * comité cree que avisó.
 *
 * EL REBOTE NO PUEDE LLEVAR LA DIRECCIÓN. envio_eventos lo lee cualquiera del
 * comité, incluidas las personas que todavía están ciegas para ese envío, y
 * §7 oculta el correo del autor precisamente hasta que dictaminen. Un aviso de
 * rebote con `to` dentro sería una puerta trasera a la autoría, abierta por la
 * bandeja de entrada. Aquí se guarda el tipo de evento y el id de Resend, y el
 * folio se saca del asunto, no del destinatario.
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Los folios van en el asunto de todos los correos que manda la revista. */
const FOLIO = /VTX-\d{4}-\d{1,4}/;

const INTERESANTES = new Set([
  "email.bounced",
  "email.complained",
  "email.delivered",
  "email.delivery_delayed",
]);

type Evento = { type?: string; data?: { email_id?: string; subject?: string } };

export async function POST(req: Request) {
  const log = bitacora("POST /api/webhooks/resend");

  const secreto = process.env.RESEND_WEBHOOK_SECRET;
  if (!secreto) {
    // Sin secreto no se acepta nada. Un webhook sin verificar es un endpoint
    // que cualquiera puede usar para escribir en la bitácora.
    log.error("sin_secreto");
    return json({ error: "no configurado" }, 503);
  }

  const cuerpo = await req.text();
  const firmada = verificaSvix(
    {
      id: req.headers.get("svix-id"),
      timestamp: req.headers.get("svix-timestamp"),
      firma: req.headers.get("svix-signature"),
    },
    cuerpo,
    secreto,
  );

  if (!firmada) {
    log.info("firma_invalida");
    return json({ error: "firma inválida" }, 401);
  }

  let evento: Evento;
  try {
    evento = JSON.parse(cuerpo) as Evento;
  } catch {
    return json({ error: "cuerpo ilegible" }, 400);
  }

  const tipo = evento.type ?? "";
  if (!INTERESANTES.has(tipo)) {
    // 200 a propósito: si se devolviera un error, Svix reintentaría un evento
    // que no interesa hasta rendirse.
    return json({ ok: true, ignorado: tipo });
  }

  const sb = servidor();
  const folio = evento.data?.subject?.match(FOLIO)?.[0];

  // Sin folio puede ser una invitación al comité: ésas no llevan folio porque
  // no cuelgan de ningún envío. Se casan por el id que Resend devolvió al
  // mandarlas, que es lo que guarda usuarios.invitacion_email_id — nunca por la
  // dirección.
  if (!folio) return invitacion(sb, evento, tipo, log);

  const { data: envio } = await sb.from("envios").select("id").eq("folio", folio).maybeSingle();

  if (!envio) {
    log.info("folio_desconocido", { tipo });
    return json({ ok: true });
  }

  log.conFolio(folio);
  log.info("correo", { tipo });

  // Lo que se guarda: qué pasó y el id de Resend para poder buscarlo en su
  // panel. Ni la dirección ni el asunto completo.
  const { error } = await sb.from("envio_eventos").insert({
    envio_id: envio.id,
    tipo: tipo === "email.delivered" ? "correo_entregado" : "correo_rebotado",
    payload: { evento: tipo, email_id: evento.data?.email_id ?? null },
  });

  if (error) {
    log.error("no_registrado", { error: error.message });
    // 500 para que Svix reintente: perder un rebote es perder justo la señal
    // que este endpoint existe para no perder.
    return json({ error: "no se pudo registrar" }, 500);
  }

  return json({ ok: true });
}

/**
 * La otra clase de correo que manda la revista: la invitación al comité.
 *
 * No cuelga de ningún envío, así que no tiene folio ni fila en envio_eventos;
 * el estado vive en la propia persona. La llave es el id de Resend guardado al
 * mandarla, no la dirección — la regla de la cabecera de este archivo vale
 * igual aquí.
 *
 * Sin esto, una invitación a una dirección mal tecleada se veía exactamente
 * igual que una que la persona no ha abierto todavía.
 */
async function invitacion(
  sb: ReturnType<typeof servidor>,
  evento: Evento,
  tipo: string,
  log: ReturnType<typeof bitacora>,
): Promise<Response> {
  const emailId = evento.data?.email_id;
  const estado = estadoDeEvento(tipo);

  if (!emailId || !estado) {
    log.info("sin_folio", { tipo });
    return json({ ok: true, sin_folio: true });
  }

  const { data, error } = await sb
    .from("usuarios")
    .update({ invitacion_estado: estado })
    .eq("invitacion_email_id", emailId)
    .select("id");

  if (error) {
    log.error("invitacion_no_registrada", { error: error.message });
    return json({ error: "no se pudo registrar" }, 500);
  }

  if (!data?.length) {
    // Ni envío ni invitación: un correo que no manda esta aplicación, o uno
    // anterior a que se guardaran los ids. No es un fallo.
    log.info("email_id_desconocido", { tipo });
    return json({ ok: true });
  }

  log.info("invitacion", { tipo, estado });
  return json({ ok: true });
}
