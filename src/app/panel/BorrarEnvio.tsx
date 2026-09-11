"use client";

import { useActionState, useState, type CSSProperties } from "react";
import { borrarEnvio, type Resultado } from "./acciones";

const fondoModal: CSSProperties = {
  position: "fixed",
  inset: 0,
  zIndex: 1000,
  display: "grid",
  placeItems: "center",
  padding: 24,
  background: "rgba(45,35,46,.45)",
};

const panelModal: CSSProperties = {
  width: "min(520px, 100%)",
  background: "var(--fondo)",
  border: "1px solid var(--linea-fuerte)",
  borderRadius: 14,
  padding: 22,
  boxShadow: "0 20px 60px rgba(45,35,46,.25)",
};

export default function BorrarEnvio({ envio, folio }: { envio: string; folio: string }) {
  const [abierto, setAbierto] = useState(false);
  const [estado, ejecutar, pendiente] = useActionState<Resultado | null, FormData>(
    async (_previo, datos) => borrarEnvio(datos),
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
          <div style={panelModal} role="dialog" aria-modal="true" aria-labelledby={`borrar-${envio}`}>
            <h3 id={`borrar-${envio}`} style={{ marginTop: 0 }}>Eliminar envío</h3>
            <p>
              Se eliminará definitivamente el registro <strong>{folio}</strong> y sus datos relacionados de la base.
              Los archivos almacenados no se borrarán.
            </p>
            <p className="nota">Esta acción sólo funciona mientras el envío no tenga una decisión registrada.</p>
            <form action={ejecutar} style={{ display: "flex", justifyContent: "flex-end", gap: 10, flexWrap: "wrap", marginTop: 18 }}>
              <input type="hidden" name="envio" value={envio} />
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
