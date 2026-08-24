import { sesion } from "@/lib/supabase/sesion";
import Accion from "../../Accion";
import { registrarDecision } from "../../acciones";
import type { Tabla } from "@/lib/supabase/tipos";

/**
 * Grabar la decisión del comité.
 *
 * Es el segundo disparador de desvelado de §7.2: en cuanto hay decision_id, la
 * autoría deja de estar oculta para TODO el comité, no sólo para quien la
 * grabó. Con un único rol eso no se puede impedir, y la spec lo acepta como
 * riesgo residual; lo que sí se hace es que no pueda pasar sin dejar rastro —
 * la restricción envios_decision_con_actor exige quién y cuándo, y la función
 * escribe la fila en envio_eventos en la misma transacción.
 *
 * Por eso el botón pide confirmación. No es una molestia decorativa: es la
 * única acción del panel que le quita la ceguera a personas que no la pidieron.
 *
 * Las decisiones que se ofrecen son las del INSTRUMENTO de esta pieza, no un
 * catálogo global. "Requiere reelaboración" es un veredicto de Nivel C que no
 * existe en el vocabulario de Nivel A, y ofrecerlo aquí sería ofrecer un
 * veredicto que el instrumento no contempla.
 */
export default async function Decision({ envio }: { envio: Tabla<"envios"> }) {
  const sb = await sesion();

  if (envio.decision_id) {
    const [{ data: decision }, { data: quienGrabo }] = await Promise.all([
      sb.from("decisiones").select("etiqueta").eq("id", envio.decision_id).maybeSingle(),
      envio.decision_final_por
        ? sb.from("usuarios").select("nombre").eq("id", envio.decision_final_por).maybeSingle()
        : Promise.resolve({ data: null }),
    ]);

    return (
      <>
        <h3>Decisión</h3>
        <div className="tarjeta">
          <p style={{ margin: 0, font: "600 18px var(--f-ui)", color: "var(--tinta)" }}>
            {decision?.etiqueta ?? "—"}
          </p>
          <p className="nota">
            Grabada por {quienGrabo?.nombre ?? "—"} el{" "}
            {envio.decision_final_at
              ? new Date(envio.decision_final_at).toLocaleString("es-MX", {
                  dateStyle: "medium",
                  timeStyle: "short",
                })
              : "—"}
            . El autor ya recibió el aviso en su idioma.
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
            No se puede grabar una decisión antes del triaje: todavía no hay
            instrumento, y las decisiones son las de un instrumento concreto.
          </p>
        </div>
      </>
    );
  }

  const { data: rubrica } = await sb
    .from("rubrica_versiones")
    .select("id, etiqueta_pendiente")
    .eq("seccion_id", envio.seccion_dictamen_id)
    .eq("vigente", true)
    .maybeSingle();

  const { data: todas } = rubrica
    ? await sb
        .from("decisiones")
        .select("id, etiqueta")
        .eq("rubrica_version_id", rubrica.id)
        .order("orden")
    : { data: [] };

  // "Pendiente de dictamen" es una fila de `decisiones` porque el motor tiene
  // que poder apuntar a ella cuando aún no se ha calificado nada — pero no es
  // un veredicto y no se puede grabar. Grabarla pondría decision_id, que
  // desvela la autoría a todo el comité y le manda al autor un correo diciendo
  // que la decisión sobre su manuscrito es "pendiente".
  const decisiones = (todas ?? []).filter((d) => d.etiqueta !== rubrica?.etiqueta_pendiente);

  return (
    <>
      <h3>Decisión</h3>
      <div className="tarjeta">
        <p className="nota" style={{ marginTop: 0 }}>
          Grabar la decisión avisa al autor por correo, en el idioma con el que envió,
          y deja de ocultar la autoría a todo el comité. Queda registrado quién la
          grabó y cuándo.
        </p>
        <Accion
          accion={registrarDecision}
          etiqueta="Grabar decisión"
          lleno
          confirmar="Grabar la decisión avisa al autor y quita la ceguera a todo el comité. ¿Continuar?"
        >
          <input type="hidden" name="envio" value={envio.id} />
          <div className="campo" style={{ maxWidth: 420 }}>
            <label htmlFor="decision">Decisión del comité</label>
            <select id="decision" name="decision" defaultValue="">
              <option value="">Elige una</option>
              {decisiones.map((d) => (
                <option key={d.id} value={d.id}>{d.etiqueta}</option>
              ))}
            </select>
          </div>
        </Accion>
      </div>
    </>
  );
}
