import { sesion, type Personal } from "@/lib/supabase/sesion";
import Accion from "../../Accion";
import { abrirDictamen } from "../../acciones";
import type { Tabla } from "@/lib/supabase/tipos";

/**
 * Los dictámenes enviados, lado a lado, con el desacuerdo marcado (spec §6.3).
 *
 * Lo que se enseña es la INSTANTÁNEA: el puntaje, el máximo, las puertas, los
 * críticos y la decisión sugerida tal como quedaron el día que se envió la
 * tarjeta. No se recalcula, ni aunque la rúbrica cambie después. Lo que el
 * comité vio es lo que decidió, y el registro tiene que poder enseñar eso.
 *
 * La decisión sugerida no es la decisión. La que cuenta —la que ve el autor y
 * la que abre la puerta a publicar— es la que alguien graba a mano más abajo.
 */
export default async function Dictamenes({
  envio,
  quien,
}: {
  envio: Tabla<"envios">;
  quien: Personal;
}) {
  const sb = await sesion();

  const { data: dictamenes } = await sb
    .from("dictamenes")
    .select("id, revisor_id, estado, puntaje, maximo, puertas_ok, criticos_ok, decision_sugerida_id, comentarios, enviado_at")
    .eq("envio_id", envio.id);

  const [{ data: personas }, { data: decisiones }, { data: asignada }] = await Promise.all([
    sb.from("usuarios").select("id, nombre"),
    sb.from("decisiones").select("id, etiqueta"),
    sb.from("asignaciones").select("revisor_id").eq("envio_id", envio.id).eq("revisor_id", quien.id).maybeSingle(),
  ]);

  const nombre = new Map((personas ?? []).map((p) => [p.id, p.nombre]));
  const etiqueta = new Map((decisiones ?? []).map((d) => [d.id, d.etiqueta]));

  const enviados = (dictamenes ?? []).filter((d) => d.estado === "enviado");
  const mio = (dictamenes ?? []).find((d) => d.revisor_id === quien.id);

  // Desacuerdo: dos tarjetas enviadas que sugieren decisiones distintas. No es
  // un error —para eso hay dos dictaminadores— pero es lo que el comité tiene
  // que mirar antes de grabar nada.
  const sugerencias = new Set(enviados.map((d) => d.decision_sugerida_id));
  const hayDesacuerdo = enviados.length > 1 && sugerencias.size > 1;

  return (
    <>
      <h3>Dictámenes</h3>
      <div className="tarjeta">
        {enviados.length === 0 ? (
          <p className="nota" style={{ marginTop: 0 }}>Todavía no hay dictámenes enviados.</p>
        ) : (
          <>
            {hayDesacuerdo && (
              <p className="aviso" style={{ marginTop: 0 }}>
                Los dictámenes enviados no coinciden en la decisión que sugieren.
              </p>
            )}
            <table>
              <thead>
                <tr>
                  <th>Dictaminador</th>
                  <th>Puntaje</th>
                  <th>Puertas ★</th>
                  <th>Críticos ★</th>
                  <th>Sugiere</th>
                </tr>
              </thead>
              <tbody>
                {enviados.map((d) => (
                  <tr key={d.id}>
                    <td>
                      {nombre.get(d.revisor_id) ?? "—"}
                      {d.revisor_id === quien.id && <span className="nota"> · tú</span>}
                    </td>
                    <td>{d.puntaje} / {d.maximo}</td>
                    <td>{d.puertas_ok ? "Sí" : "No"}</td>
                    <td>{d.criticos_ok ? "Sí" : "No"}</td>
                    <td>{d.decision_sugerida_id ? etiqueta.get(d.decision_sugerida_id) : "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {enviados.some((d) => d.comentarios) && (
              <div style={{ marginTop: 18 }}>
                {enviados
                  .filter((d) => d.comentarios)
                  .map((d) => (
                    <div key={d.id} style={{ marginBottom: 12 }}>
                      <p className="nota" style={{ margin: 0 }}>{nombre.get(d.revisor_id)}</p>
                      <p style={{ margin: "2px 0 0" }}>{d.comentarios}</p>
                    </div>
                  ))}
              </div>
            )}
          </>
        )}

        {/* Sólo quien está asignada puede abrir tarjeta, y lo impone la llave
            compuesta de la base, no este `if`. */}
        {asignada && (
          <div style={{ marginTop: 18 }}>
            {mio?.estado === "enviado" ? (
              <p className="nota" style={{ margin: 0 }}>
                Ya enviaste tu dictamen de esta pieza, así que ves la autoría.
              </p>
            ) : (
              <Accion
                accion={abrirDictamen}
                etiqueta={mio ? "Retomar mi dictamen" : "Empezar mi dictamen"}
                lleno
              >
                <input type="hidden" name="envio" value={envio.id} />
              </Accion>
            )}
          </div>
        )}
      </div>
    </>
  );
}
