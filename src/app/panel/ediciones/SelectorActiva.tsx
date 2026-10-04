"use client";

import { useTransition } from "react";
import { activarEdicion } from "./acciones";

export default function SelectorActiva({ edicion, activa }: { edicion: number; activa: boolean }) {
  const [pendiente, iniciar] = useTransition();

  return (
    <label style={{ display: "inline-flex", alignItems: "center", gap: 8, margin: 0, textTransform: "none", letterSpacing: 0 }}>
      <input
        type="checkbox"
        checked={activa}
        disabled={pendiente}
        aria-label={activa ? "Desactivar edición" : "Activar edición"}
        onChange={(e) => {
          const siguiente = e.currentTarget.checked;
          iniciar(async () => {
            await activarEdicion(edicion, siguiente);
          });
        }}
        style={{ width: "auto" }}
      />
      {activa ? "Activa" : "Inactiva"}
    </label>
  );
}
