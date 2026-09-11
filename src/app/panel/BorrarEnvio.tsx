"use client";

import { useActionState, useState } from "react";
import { borrarEnvio, type Resultado } from "./acciones";

export default function BorrarEnvio({ envio, folio }: { envio: string; folio: string }) {
  const [abierto, setAbierto] = useState(false);
  const [estado, ejecutar, pendiente] = useActionState<Resultado | null, FormData>(
    async (_previo, datos) => borrarEnvio(datos),
    null,
  );

  return (
    <>
      <button type="button" className="boton boton--peligro" onClick={() => setAbierto(true)}>
        Eliminar
      </button>
      {estado?.mensaje && !estado.ok && <p className="aviso">{estado.mensaje}</p>}

      {abierto && (
        <div className="modal-fondo" role="presentation">
          <div className="modal-panel" role="dialog" aria-modal="true" aria-labelledby={`borrar-${envio}`}>
            <h3 id={`borrar-${envio}`} style={{ marginTop: 0 }}>Eliminar envío</h3>
            <p>
              Se eliminará definitivamente el registro <strong>{folio}</strong> y sus datos relacionados de la base.
              Los archivos almacenados no se borrarán.
            </p>
            <p className="nota">Esta acción sólo funciona mientras el envío no tenga una decisión registrada.</p>
            <form action={ejecutar} className="modal-acciones">
              <input type="hidden" name="envio" value={envio} />
              <button type="button" className="boton" onClick={() => setAbierto(false)} disabled={pendiente}>
                Cancelar
              </button>
              <button type="submit" className="boton boton--peligro" disabled={pendiente}>
                {pendiente ? "Eliminando…" : "Eliminar definitivamente"}
              </button>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
