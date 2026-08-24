import Accion from "../Accion";
import { activarInvitacion } from "./acciones";

/**
 * La página puente del enlace de invitación.
 *
 * No canjea nada al abrirse, y ésa es toda su razón de ser: el token es de un
 * solo uso y los escáneres de enlaces del correo institucional lo gastaban
 * antes que la persona cuando el canje vivía en el GET. Aquí hay que pulsar un
 * botón, y un escáner no pulsa botones.
 *
 * No lleva guardia de sesión —es justo donde llega quien todavía no tiene
 * ninguna— y el token que trae en la query es la única credencial que hace
 * falta: lo valida `verifyOtp` en la acción.
 */

export const dynamic = "force-dynamic";

export default async function Invitacion({
  searchParams,
}: {
  searchParams: Promise<{ token_hash?: string; type?: string; siguiente?: string }>;
}) {
  const { token_hash = "", type = "", siguiente = "/panel/clave" } = await searchParams;

  return (
    <main className="panel-marco">
      <div className="entrar">
        <h2>Tu acceso al comité</h2>

        {token_hash ? (
          <>
            <p className="nota">
              Pulsa el botón para activar tu cuenta y elegir tu contraseña. El enlace
              es de un solo uso, así que hazlo desde el dispositivo en el que quieras
              quedarte con la sesión abierta.
            </p>
            <div style={{ marginTop: 24 }}>
              <Accion accion={activarInvitacion} etiqueta="Activar mi cuenta" lleno>
                <input type="hidden" name="token_hash" value={token_hash} />
                <input type="hidden" name="type" value={type} />
                <input type="hidden" name="siguiente" value={siguiente} />
              </Accion>
            </div>
          </>
        ) : (
          <p className="aviso">
            Este enlace está incompleto. Abre el que te llegó por correo tal cual, sin
            recortarlo, o pide a quien te invitó que te lo mande otra vez.
          </p>
        )}
      </div>
    </main>
  );
}
