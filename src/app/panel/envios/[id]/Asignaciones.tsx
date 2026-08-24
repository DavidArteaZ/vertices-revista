import { sesion, type Personal } from "@/lib/supabase/sesion";
import Accion from "../../Accion";
import { asignar, desasignar } from "../../acciones";
import type { Tabla } from "@/lib/supabase/tipos";

/**
 * Quién dictamina esta pieza.
 *
 * La lista de candidatos NO sale de `usuarios`: sale de
 * public.candidatos_asignacion, que quita a quien tenga conflicto de interés
 * comparando el correo del autor con el institucional y con los alternos del
 * personal (spec §7.3). La comparación vive dentro de la función porque quien
 * mira esta pantalla no puede ver ese correo — es justo lo que la ceguera
 * oculta.
 *
 * Y la función no dice por qué falta alguien. Decir «no se puede asignar a
 * Ana, su correo coincide» convertiría este selector en un oráculo: se recorre
 * la lista de diez personas y la única ausente es la autora.
 */
export default async function Asignaciones({
  envio,
  quien,
}: {
  envio: Tabla<"envios">;
  quien: Personal;
}) {
  const sb = await sesion();

  const [{ data: asignados }, { data: candidatos }, { data: personas }] = await Promise.all([
    sb.from("asignaciones").select("revisor_id, asignado_at").eq("envio_id", envio.id),
    sb.rpc("candidatos_asignacion", { p_envio: envio.id }),
    sb.from("usuarios").select("id, nombre"),
  ]);

  const nombre = new Map((personas ?? []).map((p) => [p.id, p.nombre]));
  const { data: dictamenes } = await sb
    .from("dictamenes")
    .select("revisor_id, estado")
    .eq("envio_id", envio.id);

  const estadoDe = (revisor: string) =>
    (dictamenes ?? []).find((d) => d.revisor_id === revisor)?.estado;

  return (
    <>
      <h3>Dictaminadores</h3>
      <div className="tarjeta">
        {!envio.nivel && (
          <p className="nota" style={{ marginTop: 0 }}>
            Esta pieza no se puede asignar hasta que pase por triaje: sin nivel no hay
            instrumento con el que dictaminar.
          </p>
        )}

        {(asignados ?? []).length === 0 ? (
          <p className="nota" style={{ marginTop: 0 }}>Nadie asignado todavía.</p>
        ) : (
          <table>
            <tbody>
              {(asignados ?? []).map((a) => {
                const estado = estadoDe(a.revisor_id);
                return (
                  <tr key={a.revisor_id}>
                    <td>
                      {nombre.get(a.revisor_id) ?? "—"}
                      {a.revisor_id === quien.id && <span className="nota"> · tú</span>}
                    </td>
                    <td>
                      {estado === "enviado" ? (
                        <span className="etiqueta etiqueta--lista">Dictamen enviado</span>
                      ) : estado === "borrador" ? (
                        <span className="etiqueta etiqueta--curso">Borrador</span>
                      ) : (
                        <span className="etiqueta etiqueta--pendiente">Sin empezar</span>
                      )}
                    </td>
                    <td style={{ textAlign: "right" }}>
                      {estado !== "enviado" && (
                        <Accion accion={desasignar} etiqueta="Quitar">
                          <input type="hidden" name="envio" value={envio.id} />
                          <input type="hidden" name="revisor" value={a.revisor_id} />
                        </Accion>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}

        {envio.nivel && (candidatos ?? []).length > 0 && (
          <div style={{ marginTop: 18 }}>
            <Accion accion={asignar} etiqueta="Asignar">
              <input type="hidden" name="envio" value={envio.id} />
              <div className="campo" style={{ maxWidth: 300 }}>
                <label htmlFor="revisor">Añadir dictaminador</label>
                <select id="revisor" name="revisor" defaultValue="">
                  <option value="">Elige a alguien</option>
                  {(candidatos ?? []).map((c) => (
                    <option key={c.id} value={c.id}>{c.nombre}</option>
                  ))}
                </select>
              </div>
            </Accion>
          </div>
        )}

        {envio.nivel && (candidatos ?? []).length === 0 && (asignados ?? []).length > 0 && (
          <p className="nota">No queda nadie más a quien asignar.</p>
        )}
      </div>
    </>
  );
}
