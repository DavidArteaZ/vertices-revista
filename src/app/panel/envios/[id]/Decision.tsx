import { sesion } from "@/lib/supabase/sesion";
import type { Tabla } from "@/lib/supabase/tipos";
import FormularioDecision from "./FormularioDecision";

/**
 * La decisión final del comité usa un vocabulario común de cuatro opciones.
 * Las sugerencias automáticas de cada instrumento siguen viviendo en sus
 * propias rúbricas y no se modifican aquí.
 */
export default async function Decision({ envio }: { envio: Tabla<"envios"> }) {
  const sb = await sesion();

  if (envio.decision_id) {
    const [{ data: decision }, { data: quienGrabo }, { data: evento }] = await Promise.all([
      sb.from("decisiones").select("etiqueta").eq("id", envio.decision_id).maybeSingle(),
      envio.decision_final_por
        ? sb.from("usuarios").select("nombre").eq("id", envio.decision_final_por).maybeSingle()
        : Promise.resolve({ data: null }),
      sb
        .from("envio_eventos")
        .select("payload")
        .eq("envio_id", envio.id)
        .eq("tipo", "decision_registrada")
        .order("at", { ascending: false })
        .limit(1)
        .maybeSingle(),
    ]);

    const nombreConfirmacion =
      evento?.payload &&
      typeof evento.payload === "object" &&
      !Array.isArray(evento.payload) &&
      typeof evento.payload.nombre_confirmacion === "string"
        ? evento.payload.nombre_confirmacion
        : null;

    return (
      <>
        <h3>Decisión</h3>
        <div className="tarjeta">
          <p style={{ margin: 0, font: "600 18px var(--f-ui)", color: "var(--tinta)" }}>
            {envio.decision_final ?? decision?.etiqueta ?? "—"}
          </p>
          <p className="nota">
            Grabada por {quienGrabo?.nombre ?? "—"} el{" "}
            {envio.decision_final_at
              ? new Date(envio.decision_final_at).toLocaleString("es-MX", {
                  dateStyle: "medium",
                  timeStyle: "short",
                })
              : "—"}
            .
            {nombreConfirmacion && <> Nombre escrito en la confirmación: {nombreConfirmacion}.</>}
          </p>
        </div>
      </>
    );
  }

  if (!envio.seccion_dictamen_id) {
    return (
      <>
        <h3>Decisión</h3>
        <div className="tarjeta">
          <p className="nota" style={{ margin: 0 }}>
            No se puede grabar una decisión antes del triaje: todavía no hay instrumento de dictamen.
          </p>
        </div>
      </>
    );
  }

  const { data: ediciones } = await sb
    .from("ediciones")
    .select("id, numero, titulo")
    .eq("estado", "borrador")
    .order("numero", { ascending: false });

  return (
    <>
      <h3>Decisión</h3>
      <div className="tarjeta">
        <p className="nota" style={{ marginTop: 0 }}>
          La decisión final es independiente de la sugerencia automática de la rúbrica. Al confirmarla se avisa al autor,
          se deja de ocultar la autoría a todo el comité y queda registro de quién la confirmó.
        </p>
        {(ediciones ?? []).length === 0 ? (
          <p className="aviso">Crea primero una edición en borrador: el correo de decisión necesita sus datos editoriales.</p>
        ) : (
          <FormularioDecision envio={envio.id} ediciones={ediciones ?? []} locale={envio.locale} />
        )}
      </div>
    </>
  );
}
