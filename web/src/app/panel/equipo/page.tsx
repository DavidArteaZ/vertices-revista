import { sesion } from "@/lib/supabase/sesion";
import { exigePersonal, Cabecera } from "../guardia";
import Accion from "../Accion";
import { invitar, cambiarActivo } from "./acciones";

/**
 * El comité: quién entra.
 *
 * El chequeo de conflicto de interés compara el correo de la autoría contra el
 * del comité, y además contra `usuario_correos` — direcciones alternas de la
 * misma persona (spec §7.3). Esa tabla se llenaba desde aquí y se quitó: la
 * columna confundía más de lo que ayudaba. La comparación sigue en pie, pero
 * hoy sólo cubre el correo con el que cada quien entra al panel; quien mande su
 * artículo desde otra dirección puede acabar dictaminándose a sí mismo.
 */

export const dynamic = "force-dynamic";

export default async function Equipo() {
  const quien = await exigePersonal();
  const sb = await sesion();

  const { data: personas } = await sb
    .from("usuarios")
    .select("id, nombre, email, activo")
    .order("nombre");

  return (
    <main className="panel-marco">
      <Cabecera quien={quien} />

      <h2>Comité editorial</h2>
      <p className="nota">
        No hay alta pública: se entra por invitación y se sale por baja. Dar de baja
        conserva los dictámenes de quien se va — borrarlos destruiría la instantánea
        de lo que el comité vio el día que dictaminó.
      </p>

      <h3>Personas</h3>
      <div className="tarjeta">
        <table>
          <thead>
            <tr>
              <th>Nombre</th>
              <th>Correo</th>
              <th>Estado</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {(personas ?? []).map((p) => (
              <tr key={p.id}>
                <td>
                  {p.nombre}
                  {p.id === quien.id && <span className="nota"> · tú</span>}
                </td>
                <td>{p.email}</td>
                <td>
                  <span className={`etiqueta ${p.activo ? "etiqueta--lista" : "etiqueta--alerta"}`}>
                    {p.activo ? "Activa" : "De baja"}
                  </span>
                </td>
                <td style={{ textAlign: "right" }}>
                  {p.id !== quien.id && (
                    <Accion accion={cambiarActivo} etiqueta={p.activo ? "Dar de baja" : "Reactivar"}>
                      <input type="hidden" name="usuario" value={p.id} />
                      <input type="hidden" name="activo" value={p.activo ? "no" : "si"} />
                    </Accion>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <h3>Invitar</h3>
      <div className="tarjeta">
        <Accion accion={invitar} etiqueta="Enviar invitación" lleno>
          <div className="fila">
            <div className="campo">
              <label htmlFor="nombre">Nombre</label>
              <input type="text" id="nombre" name="nombre" />
            </div>
            <div className="campo">
              <label htmlFor="correo">Correo institucional</label>
              <input type="email" id="correo" name="correo" />
            </div>
          </div>
        </Accion>
        <p className="nota">
          Recibirá un enlace para elegir su contraseña. El enlace caduca; si expira,
          vuelve a invitarla.
        </p>
      </div>
    </main>
  );
}
