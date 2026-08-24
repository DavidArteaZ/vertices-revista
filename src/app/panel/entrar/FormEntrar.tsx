"use client";

import { useActionState } from "react";
import { entrar } from "../acciones";
import type { Resultado } from "../acciones";

/**
 * El formulario de entrada. Lo único que necesita estado es el resultado de la
 * última llamada y el «entrando…»; el motivo por el que se llegó aquí lo lee la
 * página, que es de servidor.
 */
export default function FormEntrar({ motivo }: { motivo?: string }) {
  const [estado, ejecutar, pendiente] = useActionState<Resultado | null, FormData>(
    async (previo, datos) => entrar(previo, datos),
    null,
  );

  return (
    <>
      {motivo === "enlace_caducado" && (
        <p className="aviso" style={{ marginTop: 20 }}>
          Tu enlace de invitación caducó o ya se había usado, así que no llegaste a
          elegir contraseña. Pide a quien te invitó que te lo reenvíe desde la
          pantalla del comité.
        </p>
      )}

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
    </>
  );
}
