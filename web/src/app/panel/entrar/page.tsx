"use client";

import { useActionState } from "react";
import { entrar } from "../acciones";
import type { Resultado } from "../acciones";

/**
 * Entrada al panel. Sólo correo y contraseña: las cuentas son por invitación
 * (spec §13), así que no hay alta pública ni la habrá — la invitación la manda
 * el comité desde /panel/equipo.
 *
 * No hay "olvidé mi contraseña" todavía. Supabase sabe mandar ese correo, pero
 * el enlace vuelve a una pantalla que no existe; queda para cuando el panel
 * tenga su propia ruta de recuperación.
 */
export default function Entrar() {
  const [estado, ejecutar, pendiente] = useActionState<Resultado | null, FormData>(
    async (previo, datos) => entrar(previo, datos),
    null,
  );

  return (
    <main className="panel-marco">
      <div className="entrar">
        <h2>Panel editorial</h2>
        <p className="nota">Vértices · Facultad de Economía</p>

        <form action={ejecutar} style={{ marginTop: 26 }}>
          <div className="campo">
            <label htmlFor="correo">Correo</label>
            <input type="email" id="correo" name="correo" autoComplete="username" required />
          </div>
          <div className="campo">
            <label htmlFor="clave">Contraseña</label>
            <input
              type="password"
              id="clave"
              name="clave"
              autoComplete="current-password"
              required
            />
          </div>
          <button type="submit" className="boton boton--lleno" disabled={pendiente}>
            {pendiente ? "Entrando…" : "Entrar"}
          </button>
          {estado?.mensaje && <p className="aviso">{estado.mensaje}</p>}
        </form>
      </div>
    </main>
  );
}
