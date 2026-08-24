import { servidor } from "@/lib/supabase/servidor";
import { bitacora, json } from "@/lib/api/peticion";
import { Resend } from "resend";

/**
 * El resumen semanal (spec §15).
 *
 * Lo que vigila es que nada se quede quieto sin que nadie lo note: piezas sin
 * triar, piezas sin dictaminador, tarjetas en borrador que llevan semanas
 * abiertas y piezas con todos los dictámenes enviados esperando una decisión.
 *
 * Ninguna de esas cosas rompe nada — ése es el problema. Un envío sin asignar
 * no da error, no aparece en rojo y no le pasa nada durante meses; el sistema
 * anterior perdía manuscritos precisamente así, en silencio. El resumen
 * convierte el silencio en un correo.
 *
 * Va en español y sin nombres de autor: se manda a todo el comité, incluida
 * gente que sigue ciega para esas piezas, así que sólo lleva folios y títulos.
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Días que puede llevar una tarjeta en borrador antes de aparecer aquí. */
const DIAS_BORRADOR = 14;

export async function GET(req: Request) {
  const log = bitacora("GET /api/mantenimiento/digest");

  const secreto = process.env.CRON_SECRET;
  if (!secreto || req.headers.get("authorization") !== `Bearer ${secreto}`) {
    return json({ error: "no autorizado" }, 401);
  }

  const sb = servidor();

  const [{ data: envios }, { data: asignaciones }, { data: dictamenes }, { data: comite }] =
    await Promise.all([
      sb
        .from("envios")
        .select("id, folio, titulo, nivel, estado, decision_id, created_at")
        .is("archivado_at", null),
      sb.from("asignaciones").select("envio_id, revisor_id"),
      sb.from("dictamenes").select("envio_id, estado, updated_at"),
      sb.from("usuarios").select("email").eq("activo", true),
    ]);

  const lista = envios ?? [];
  const asignados = new Set((asignaciones ?? []).map((a) => a.envio_id));

  const enviadosPorEnvio = new Map<string, number>();
  for (const d of dictamenes ?? []) {
    if (d.estado !== "enviado") continue;
    enviadosPorEnvio.set(d.envio_id, (enviadosPorEnvio.get(d.envio_id) ?? 0) + 1);
  }
  const asignadosPorEnvio = new Map<string, number>();
  for (const a of asignaciones ?? []) {
    asignadosPorEnvio.set(a.envio_id, (asignadosPorEnvio.get(a.envio_id) ?? 0) + 1);
  }

  const corte = Date.now() - DIAS_BORRADOR * 86_400_000;

  const porTriar = lista.filter((e) => !e.nivel);
  const sinAsignar = lista.filter((e) => e.nivel && !asignados.has(e.id));
  const esperandoDecision = lista.filter(
    (e) =>
      !e.decision_id &&
      (asignadosPorEnvio.get(e.id) ?? 0) > 0 &&
      (enviadosPorEnvio.get(e.id) ?? 0) >= (asignadosPorEnvio.get(e.id) ?? 0),
  );
  const borradoresViejos = (dictamenes ?? []).filter(
    (d) => d.estado === "borrador" && new Date(d.updated_at).getTime() < corte,
  );

  const bloques: string[] = [];
  const anota = (titulo: string, filas: { folio: string; titulo: string }[]) => {
    if (!filas.length) return;
    bloques.push(
      `${titulo} (${filas.length}):\n` +
        filas.map((e) => `  · ${e.folio} — ${e.titulo}`).join("\n"),
    );
  };

  anota("Sin triar: no tienen sección y por tanto no se pueden asignar", porTriar);
  anota("Triadas pero sin dictaminador", sinAsignar);
  anota("Con todos los dictámenes enviados, esperando decisión del comité", esperandoDecision);

  if (borradoresViejos.length) {
    bloques.push(
      `Tarjetas en borrador con más de ${DIAS_BORRADOR} días sin tocar: ${borradoresViejos.length}`,
    );
  }

  const resumen = {
    por_triar: porTriar.length,
    sin_asignar: sinAsignar.length,
    esperando_decision: esperandoDecision.length,
    borradores_viejos: borradoresViejos.length,
  };

  log.info("digest", resumen);

  // Si no hay nada atascado no se manda nada. Un resumen semanal que llega
  // siempre y casi siempre dice "todo bien" es un resumen que nadie abre, y
  // entonces tampoco se lee el que sí traía algo.
  if (!bloques.length) return json({ ...resumen, enviado: false, motivo: "nada atascado" });

  const clave = process.env.RESEND_API_KEY;
  const destinatarios = (comite ?? []).map((u) => u.email);

  if (!clave || destinatarios.length === 0) {
    return json({ ...resumen, enviado: false, motivo: "sin destinatarios o sin RESEND_API_KEY" });
  }

  const { error } = await new Resend(clave).emails.send({
    from: process.env.CORREO_REMITENTE ?? "Revista Vértices <onboarding@resend.dev>",
    to: destinatarios,
    subject: `Vértices · lo que está esperando (${new Date().toLocaleDateString("es-MX")})`,
    text: [
      "Resumen semanal del panel editorial.",
      "",
      ...bloques,
      "",
      "Sólo folios y títulos: este correo va a todo el comité, incluida gente",
      "que todavía no ha dictaminado estas piezas.",
      "",
      "Panel: /panel",
    ].join("\n"),
  });

  if (error) {
    log.error("digest_no_enviado", { error: error.message });
    return json({ ...resumen, enviado: false, motivo: error.message }, 500);
  }

  return json({ ...resumen, enviado: true, destinatarios: destinatarios.length });
}
