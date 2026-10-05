"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { activarEdicion } from "./acciones";

export default function SelectorActiva({ edicion, activa }: { edicion: number; activa: boolean }) {
  const router = useRouter();
  const [pendiente, iniciar] = useTransition();
  const [seleccionada, setSeleccionada] = useState(activa);

  useEffect(() => {
    setSeleccionada(activa);
  }, [activa]);

  return (
    <label style={{ display: "inline-flex", alignItems: "center", gap: 8, margin: 0, textTransform: "none", letterSpacing: 0 }}>
      <input
        type="checkbox"
        checked={seleccionada}
        disabled={pendiente}
        aria-label={seleccionada ? "Desactivar edición" : "Activar edición"}
        onChange={(e) => {
          const siguiente = e.currentTarget.checked;
          const anterior = seleccionada;
          setSeleccionada(siguiente);

          iniciar(async () => {
            const resultado = await activarEdicion(edicion, siguiente);
            if (!resultado.ok) setSeleccionada(anterior);
            router.refresh();
          });
        }}
        style={{ width: "auto" }}
      />
      {seleccionada ? "Activa" : "Inactiva"}
    </label>
  );
}
