"use client";

import { useActionState, useState } from "react";
import { fondoModal, panelModal } from "../../BorrarEnvio";
import { borrarRegistro } from "../acciones";
import type { Resultado } from "../../acciones";

export default function BorrarRegistro({ registro, edicion, nombre }: { registro: number; edicion: number; nombre: string }) {
  const [abierto, setAbierto] = useState(false);
  const [estado, ejecutar, pendiente] = useActionState<Resultado | null, FormData>(
    async (_previo, datos) => {
      const r = await borrarRegistro(datos);
      if (r.ok) setAbierto(false);
      return r;
    },
    null,
  );

  return (
    <>
      <button
        type="button"
        className="boton"
        style={{ borderColor: "var(--naranja)", color: "var(--naranja)" }}
        onClick={() => setAbierto(true)}
      >
        Eliminar
      </button>
      {estado?.mensaje && !estado.ok && <p className="aviso">{estado.mensaje}</p>}

      {abierto && (
        <div style={fondoModal} role="presentation">
          <div style={panelModal} role="dialog" aria-modal="true" aria-labelledby={`borrar-registro-${registro}`}>
            <h3 id={`borrar-registro-${registro}`} style={{ marginTop: 0 }}>Eliminar registro</h3>
            <p>
              Se eliminará definitivamente el registro de <strong>{nombre}</strong> al evento. No se le
              enviará ningún aviso y no se puede deshacer.
            </p>
            <form action={ejecutar} style={{ display: "flex", justifyContent: "flex-end", gap: 10, flexWrap: "wrap", marginTop: 18 }}>
              <input type="hidden" name="registro" value={registro} />
              <input type="hidden" name="edicion" value={edicion} />
              <button type="button" className="boton" onClick={() => setAbierto(false)} disabled={pendiente}>
                Cancelar
              </button>
              <button
                type="submit"
                className="boton"
                style={{ borderColor: "var(--naranja)", color: "var(--naranja)" }}
                disabled={pendiente}
              >
                {pendiente ? "Eliminando…" : "Eliminar definitivamente"}
              </button>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
