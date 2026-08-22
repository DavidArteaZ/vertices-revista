import { sesion } from "@/lib/supabase/sesion";
import { exigePersonal, Cabecera } from "../guardia";
import Accion from "../Accion";
import { invitar, cambiarActivo, anadirCorreo } from "./acciones";

/**
 * El comité: quién entra, y con qué correos.
 *
 * Los correos alternos no son un adorno de la ficha. Son lo que hace utilizable
 * el chequeo de conflicto de interés: en los datos reales hay gente del comité
 * que envía desde direcciones personales además de la institucional, y si sólo
 * se mirara `usuarios.email` se le podría asignar el dictamen de su propia
 * pieza sin que nada lo notara (spec §7.3).
 */

export const dynamic = "force-dynamic";

export default async function Equipo() {
  const quien = await exigePersonal();
  const sb = await sesion();

  const [{ data: personas }, { data: correos }] = await Promise.all([
    sb.from("usuarios").select("id, nombre, email, activo").order("nombre"),
    sb.from("usuario_correos").select("usuario_id, correo"),
  ]);

  const alternos = (id: string) =>
    (correos ?? []).filter((c) => c.usuario_id === id).map((c) => c.correo);

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
              <th>Alternos</th>
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
                  {alternos(p.id).length ? (
                    alternos(p.id).join(", ")
                  ) : (
                    <span className="ciego">ninguno</span>
                  )}
                  <div style={{ marginTop: 6 }}>
                    <Accion accion={anadirCorreo} etiqueta="Añadir">
                      <input type="hidden" name="usuario" value={p.id} />
                      <input
                        type="email"
                        name="correo"
                        placeholder="otro@correo"
                        style={{ maxWidth: 200, marginBottom: 6 }}
                      />
                    </Accion>
                  </div>
                </td>
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
