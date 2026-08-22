"use client";

import Link from "next/link";
import { useActionState } from "react";
import { fijarClave } from "../equipo/acciones";
import type { Resultado } from "../acciones";

/**
 * Fijar la contraseña al aceptar una invitación.
 *
 * Se llega aquí desde el enlace del correo, que ya dejó una sesión abierta al
 * pasar por /panel/auth/callback. Si esa sesión no existe —enlace caducado o
 * usado— la acción lo dice y no pasa nada más.
 */
export default function Clave() {
  const [estado, ejecutar, pendiente] = useActionState<Resultado | null, FormData>(
    async (previo, datos) => fijarClave(previo, datos),
    null,
  );

  return (
    <main className="panel-marco">
      <div className="entrar">
        <h2>Elige tu contraseña</h2>
        <p className="nota">
          Es la que usarás para entrar al panel. Mínimo doce caracteres; no se puede
          recuperar sola todavía, así que apúntala en tu gestor.
        </p>

        {estado?.ok ? (
          <p className="aviso aviso--ok">
            {estado.mensaje} <Link href="/panel">Ir al panel</Link>
          </p>
        ) : (
          <form action={ejecutar} style={{ marginTop: 24 }}>
            <div className="campo">
              <label htmlFor="clave">Contraseña</label>
              <input type="password" id="clave" name="clave" autoComplete="new-password" required />
            </div>
            <div className="campo">
              <label htmlFor="repetida">Repítela</label>
              <input
                type="password"
                id="repetida"
                name="repetida"
                autoComplete="new-password"
                required
              />
            </div>
            <button type="submit" className="boton boton--lleno" disabled={pendiente}>
              {pendiente ? "Guardando…" : "Guardar"}
            </button>
            {estado?.mensaje && <p className="aviso">{estado.mensaje}</p>}
          </form>
        )}
      </div>
    </main>
  );
}
