import { Resend } from "resend";
import { servidor } from "@/lib/supabase/servidor";
import { cuerpoJson, huellaIp, json } from "@/lib/api/peticion";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const PERFILES = new Set(["Autor/a", "Comunidad TEC", "Colaborador/a", "Autoridad"]);
const CORREO = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function POST(req: Request) {
  const sb = servidor();

  const cuerpo = await cuerpoJson(req, 16 * 1024) as {
    nombre?: unknown;
    correo?: unknown;
    perfil?: unknown;
  } | null;

  const nombre = typeof cuerpo?.nombre === "string" ? cuerpo.nombre.trim() : "";
  const correo = typeof cuerpo?.correo === "string" ? cuerpo.correo.trim().toLowerCase() : "";
  const perfil = typeof cuerpo?.perfil === "string" ? cuerpo.perfil.trim() : "";

  if (!nombre || nombre.length > 160 || !CORREO.test(correo) || correo.length > 254 || !PERFILES.has(perfil)) {
    return json({ mensaje: "Revisa los campos e inténtalo de nuevo." }, 400);
  }

  const ip = huellaIp(req);
  const { data: permitido, error: eLimite } = await sb.rpc("limitar", {
    p_clave: `registro:${ip}`,
    p_segundos: 3600,
    p_max: 20,
  });

  if (eLimite) return json({ mensaje: "No se pudo completar el registro." }, 500);
  if (!permitido) return json({ mensaje: "Demasiados intentos. Inténtalo más tarde." }, 429);

  const { data: edicion, error: eEdicion } = await sb
    .from("ediciones")
    .select("id")
    .eq("activa", true)
    .maybeSingle();

  if (eEdicion || !edicion) {
    return json({ mensaje: "El registro no está disponible en este momento." }, 409);
  }

  const { error: eRegistro } = await sb
    .from("registros_evento")
    .upsert(
      {
        edicion_id: edicion.id,
        nombre,
        correo,
        perfil,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "edicion_id,correo" },
    );

  if (eRegistro) {
    console.error(JSON.stringify({ evento: "registro_evento_fallo", error: eRegistro.message }));
    return json({ mensaje: "No se pudo completar el registro." }, 500);
  }

  const clave = process.env.RESEND_API_KEY;
  const segmento = process.env.RESEND_LISTA_REGISTRADOS;

  if (clave && segmento) {
    const partes = nombre.split(/\s+/).filter(Boolean);
    const firstName = partes.shift() ?? "";
    const lastName = partes.join(" ");

    try {
      const resend = new Resend(clave);
      const { error } = await resend.contacts.create({
        email: correo,
        firstName,
        lastName,
        unsubscribed: false,
        segments: [{ id: segmento }],
      });

      if (error) {
        console.error(JSON.stringify({
          evento: "registro_resend_no_guardado",
          correo,
          motivo: error.message,
        }));
      }
    } catch (e) {
      console.error(JSON.stringify({
        evento: "registro_resend_no_guardado",
        correo,
        motivo: (e as Error).message,
      }));
    }
  } else {
    console.error(JSON.stringify({
      evento: "registro_resend_no_guardado",
      correo,
      motivo: !clave ? "sin RESEND_API_KEY" : "sin RESEND_LISTA_REGISTRADOS",
    }));
  }

  return json({ ok: true });
}
